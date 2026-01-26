"""Analytics Service - FastAPI app for data sampling operations."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="Analytics Service",
    description="Data sampling and analytics operations",
    version="1.0.0",
)


class SampleRequest(BaseModel):
    """Request model for sampling endpoint."""

    file_path: str | None = Field(
        default=None, description="Path to CSV or Parquet file"
    )
    data: list[dict[str, Any]] | None = Field(
        default=None, description="Inline JSON array of data"
    )
    method: str = Field(
        default="random",
        description="Sampling method: random, stratified, systematic, first_n, last_n",
    )
    sample_size: int | None = Field(
        default=None, description="Number of rows to sample"
    )
    sample_fraction: float | None = Field(
        default=None, description="Fraction of rows to sample (0-1)"
    )
    stratify_column: str | None = Field(
        default=None, description="Column for stratified sampling"
    )
    seed: int | None = Field(default=None, description="Random seed for reproducibility")


class SampleResponse(BaseModel):
    """Response model for sampling endpoint."""

    success: bool
    original_count: int
    sampled_count: int
    method: str
    data: list[dict[str, Any]]


def load_data(request: SampleRequest) -> pd.DataFrame:
    """Load data from file path or inline data."""
    if request.file_path:
        path = Path(request.file_path)
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

        suffix = path.suffix.lower()
        if suffix == ".csv":
            return pd.read_csv(path)
        elif suffix == ".parquet":
            return pd.read_parquet(path)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {suffix}. Supported: .csv, .parquet",
            )
    elif request.data:
        return pd.DataFrame(request.data)
    else:
        raise HTTPException(
            status_code=400, detail="Either file_path or data must be provided"
        )


def random_sample(df: pd.DataFrame, n: int | None, frac: float | None, seed: int | None) -> pd.DataFrame:
    """Simple random sampling."""
    if n is not None:
        n = min(n, len(df))
        return df.sample(n=n, random_state=seed)
    elif frac is not None:
        return df.sample(frac=frac, random_state=seed)
    else:
        raise HTTPException(
            status_code=400, detail="Either sample_size or sample_fraction required for random sampling"
        )


def stratified_sample(
    df: pd.DataFrame, column: str, n: int | None, frac: float | None, seed: int | None
) -> pd.DataFrame:
    """Stratified sampling by a column."""
    if column not in df.columns:
        raise HTTPException(
            status_code=400, detail=f"Stratify column '{column}' not found in data"
        )

    if frac is not None:
        # Sample fraction from each group
        return df.groupby(column, group_keys=False).apply(
            lambda x: x.sample(frac=frac, random_state=seed)
        )
    elif n is not None:
        # Sample n rows total, proportionally from each group
        group_counts = df[column].value_counts(normalize=True)

        def sample_group(group: pd.DataFrame) -> pd.DataFrame:
            group_frac = group_counts.get(group[column].iloc[0], 0)
            group_n = max(1, int(n * group_frac))
            group_n = min(group_n, len(group))
            return group.sample(n=group_n, random_state=seed)

        return df.groupby(column, group_keys=False).apply(sample_group)
    else:
        raise HTTPException(
            status_code=400, detail="Either sample_size or sample_fraction required for stratified sampling"
        )


def systematic_sample(df: pd.DataFrame, n: int | None, frac: float | None) -> pd.DataFrame:
    """Systematic sampling - every nth row."""
    if n is not None:
        step = max(1, len(df) // n)
        indices = list(range(0, len(df), step))[:n]
        return df.iloc[indices]
    elif frac is not None:
        target_n = int(len(df) * frac)
        step = max(1, len(df) // target_n) if target_n > 0 else len(df)
        indices = list(range(0, len(df), step))
        return df.iloc[indices]
    else:
        raise HTTPException(
            status_code=400, detail="Either sample_size or sample_fraction required for systematic sampling"
        )


def first_n_sample(df: pd.DataFrame, n: int | None, frac: float | None) -> pd.DataFrame:
    """First N rows (head)."""
    if n is not None:
        return df.head(n)
    elif frac is not None:
        return df.head(int(len(df) * frac))
    else:
        raise HTTPException(
            status_code=400, detail="Either sample_size or sample_fraction required for first_n sampling"
        )


def last_n_sample(df: pd.DataFrame, n: int | None, frac: float | None) -> pd.DataFrame:
    """Last N rows (tail)."""
    if n is not None:
        return df.tail(n)
    elif frac is not None:
        return df.tail(int(len(df) * frac))
    else:
        raise HTTPException(
            status_code=400, detail="Either sample_size or sample_fraction required for last_n sampling"
        )


@app.post("/sample", response_model=SampleResponse)
async def sample_data(request: SampleRequest) -> SampleResponse:
    """
    Sample data from a file or inline data.

    Supports multiple sampling methods:
    - random: Simple random sampling
    - stratified: Proportional sampling by a column
    - systematic: Every nth row
    - first_n: First N rows (head)
    - last_n: Last N rows (tail)
    """
    df = load_data(request)
    original_count = len(df)

    method = request.method.lower()
    n = request.sample_size
    frac = request.sample_fraction
    seed = request.seed

    if method == "random":
        sampled_df = random_sample(df, n, frac, seed)
    elif method == "stratified":
        if not request.stratify_column:
            raise HTTPException(
                status_code=400, detail="stratify_column required for stratified sampling"
            )
        sampled_df = stratified_sample(df, request.stratify_column, n, frac, seed)
    elif method == "systematic":
        sampled_df = systematic_sample(df, n, frac)
    elif method == "first_n":
        sampled_df = first_n_sample(df, n, frac)
    elif method == "last_n":
        sampled_df = last_n_sample(df, n, frac)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown sampling method: {method}. Supported: random, stratified, systematic, first_n, last_n",
        )

    # Convert to list of dicts, handling NaN values
    sampled_data = sampled_df.where(pd.notnull(sampled_df), None).to_dict(orient="records")

    return SampleResponse(
        success=True,
        original_count=original_count,
        sampled_count=len(sampled_df),
        method=method,
        data=sampled_data,
    )


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


# =============================================================================
# Bank Statement API (Mock for Demo)
# =============================================================================

class BankStatementRequest(BaseModel):
    """Request model for bank statement endpoint."""

    account_number: str = Field(..., description="Customer account number")
    account_holder: str = Field(default="Account Holder", description="Account holder name")
    from_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    to_date: str = Field(..., description="End date (YYYY-MM-DD)")
    statement_type: str = Field(
        default="full",
        description="Statement type: full, summary, credits, debits",
    )
    include_running_balance: bool = Field(
        default=True, description="Include running balance per transaction"
    )


class BankStatementResponse(BaseModel):
    """Response model for bank statement endpoint."""

    account_number: str
    account_holder: str
    statement_period: dict[str, str]
    opening_balance: float
    closing_balance: float
    total_credits: float
    total_debits: float
    transaction_count: int
    transactions: list[dict[str, Any]]


@app.post("/bank/statement", response_model=BankStatementResponse)
async def get_bank_statement(request: BankStatementRequest) -> BankStatementResponse:
    """
    Get bank statement for a customer account.

    This is a MOCK endpoint for demo purposes.
    Returns realistic-looking sample transaction data.
    """
    import random
    from datetime import datetime, timedelta

    # Parse dates
    try:
        from_date = datetime.strptime(request.from_date, "%Y-%m-%d")
        to_date = datetime.strptime(request.to_date, "%Y-%m-%d")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")

    # Use account number as seed for consistent demo data per account
    seed = sum(ord(c) for c in request.account_number)
    random.seed(seed)

    # Sample transaction descriptions
    credit_descriptions = [
        ("Salary Credit - ACME Corp", "SAL"),
        ("NEFT-HDFC-John Smith", "NEFT"),
        ("IMPS-987654-Refund", "IMPS"),
        ("Interest Credit", "INT"),
        ("Cash Deposit - Branch", "DEP"),
        ("UPI-Google Pay-Cashback", "UPI"),
        ("RTGS-Business Payment", "RTGS"),
        ("Dividend Credit - MF", "DIV"),
    ]

    debit_descriptions = [
        ("ATM-WDL-SBI ATM MG Road", "ATM"),
        ("POS-Amazon India", "POS"),
        ("BILLPAY-Electricity BESCOM", "BILL"),
        ("UPI-Swiggy", "UPI"),
        ("UPI-Zomato", "UPI"),
        ("NEFT-Rent Payment", "NEFT"),
        ("EMI-HDFC Home Loan", "EMI"),
        ("POS-BigBasket", "POS"),
        ("UPI-PhonePe-Insurance", "UPI"),
        ("ATM-WDL-ICICI ATM Kormangala", "ATM"),
        ("POS-Reliance Fresh", "POS"),
        ("AUTOPAY-Netflix", "AUTO"),
        ("AUTOPAY-Spotify", "AUTO"),
        ("POS-Shell Petrol", "POS"),
    ]

    # Generate transactions
    transactions: list[dict[str, Any]] = []
    num_days = (to_date - from_date).days
    num_transactions = min(max(num_days, 5), 50)  # At least 5, max 50

    opening_balance = round(random.uniform(25000, 150000), 2)
    running_balance = opening_balance
    total_credits = 0.0
    total_debits = 0.0

    for _ in range(num_transactions):
        # Random date within range
        days_offset = random.randint(0, max(num_days, 1))
        txn_date = from_date + timedelta(days=days_offset)
        txn_time = f"{random.randint(8, 20):02d}:{random.randint(0, 59):02d}:{random.randint(0, 59):02d}"

        # 35% credits, 65% debits (realistic spending pattern)
        is_credit = random.random() < 0.35

        if is_credit:
            desc, txn_code = random.choice(credit_descriptions)
            # Credits tend to be larger (salary, transfers)
            amount = round(random.choice([
                random.uniform(500, 2000),      # Small credits
                random.uniform(5000, 15000),    # Medium credits
                random.uniform(30000, 80000),   # Salary range
            ]), 2)
            txn_type = "CR"
            running_balance += amount
            total_credits += amount
        else:
            desc, txn_code = random.choice(debit_descriptions)
            # Debits vary more
            amount = round(random.choice([
                random.uniform(50, 500),        # Small purchases
                random.uniform(500, 2000),      # Medium purchases
                random.uniform(2000, 10000),    # Large purchases/bills
                random.uniform(10000, 25000),   # EMIs/rent
            ]), 2)
            txn_type = "DR"
            running_balance -= amount
            total_debits += amount

        txn: dict[str, Any] = {
            "date": txn_date.strftime("%Y-%m-%d"),
            "time": txn_time,
            "description": desc,
            "type": txn_type,
            "amount": amount,
            "reference": f"{txn_code}{random.randint(10000000, 99999999)}",
        }

        if request.include_running_balance:
            txn["balance"] = round(running_balance, 2)

        transactions.append(txn)

    # Sort by date and time
    transactions.sort(key=lambda x: (x["date"], x["time"]))

    # Recalculate running balance after sorting
    if request.include_running_balance:
        running = opening_balance
        for txn in transactions:
            if txn["type"] == "CR":
                running += txn["amount"]
            else:
                running -= txn["amount"]
            txn["balance"] = round(running, 2)

    # Filter based on statement type
    if request.statement_type == "credits":
        transactions = [t for t in transactions if t["type"] == "CR"]
    elif request.statement_type == "debits":
        transactions = [t for t in transactions if t["type"] == "DR"]
    elif request.statement_type == "summary":
        transactions = []

    closing_balance = round(opening_balance + total_credits - total_debits, 2)

    return BankStatementResponse(
        account_number=request.account_number,
        account_holder=request.account_holder,
        statement_period={
            "from": request.from_date,
            "to": request.to_date,
        },
        opening_balance=opening_balance,
        closing_balance=closing_balance,
        total_credits=round(total_credits, 2),
        total_debits=round(total_debits, 2),
        transaction_count=len(transactions),
        transactions=transactions,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
