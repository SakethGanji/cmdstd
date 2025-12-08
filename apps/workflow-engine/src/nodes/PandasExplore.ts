import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * PandasExplore Node
 *
 * Spawns a Python subprocess to analyze CSV data using pandas.
 * Returns HTML output for display in the HTMLDisplay node.
 */
export class PandasExploreNode extends BaseNode {
  readonly type = 'PandasExplore';
  readonly description = 'Analyzes CSV data using Python pandas';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'PandasExplore',
    displayName: 'Pandas Explore',
    icon: 'fa:chart-bar',
    description: 'Analyzes CSV data using Python pandas and returns HTML report',
    group: ['transform'],
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' }],
    outputs: [
      {
        name: 'main',
        displayName: 'HTML Output',
        type: 'main',
        schema: {
          type: 'object',
          properties: {
            html: { type: 'string', description: 'HTML report from pandas analysis' },
            _renderAs: { type: 'string', description: 'Render hint for frontend' },
          },
        },
      },
    ],

    properties: [
      {
        displayName: 'File Path',
        name: 'filePath',
        type: 'string',
        default: '={{ $json.filePath }}',
        required: true,
        placeholder: '/path/to/data.csv',
        description: 'Path to the CSV file. Use expression to get from previous node: {{ $json.filePath }}',
      },
      {
        displayName: 'Analysis Type',
        name: 'analysisType',
        type: 'options',
        default: 'profile',
        required: true,
        options: [
          { name: 'Profile (Summary + Preview)', value: 'profile' },
          { name: 'Describe (Statistics Only)', value: 'describe' },
          { name: 'Info (Data Preview Only)', value: 'info' },
        ],
        description: 'Type of pandas analysis to perform',
      },
    ],
  };

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const analysisType = this.getParameter<string>(nodeDefinition, 'analysisType', 'profile');
    // filePath is resolved from expression by WorkflowRunner before execute() is called
    const filePath = this.getParameter<string>(nodeDefinition, 'filePath');

    if (!filePath) {
      throw new Error('Missing file path. Configure the filePath parameter with a path or expression like {{ $json.filePath }}');
    }

    const results: NodeData[] = [];

    for (const _item of inputData.length > 0 ? inputData : [{ json: {} }]) {

      const pythonInput = JSON.stringify({
        filePath,
        analysisType,
      });

      const html = await this.runPythonScript(pythonInput);

      results.push({
        json: {
          html,
          _renderAs: 'html',
        },
      });
    }

    return this.output(results);
  }

  private runPythonScript(input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const scriptPath = join(__dirname, '../../scripts/pandas_explore.py');

      const pythonProcess = spawn('python3', [scriptPath, input]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          // Try to parse error from stderr
          try {
            const errorData = JSON.parse(stderr);
            reject(new Error(errorData.error || `Python script failed with code ${code}`));
          } catch {
            reject(new Error(stderr || `Python script failed with code ${code}`));
          }
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result.html);
          }
        } catch {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      });

      pythonProcess.on('error', (err) => {
        reject(new Error(`Failed to spawn Python process: ${err.message}`));
      });
    });
  }
}
