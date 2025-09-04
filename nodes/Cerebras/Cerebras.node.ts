import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { APIError } from 'openai/error';

// Available Cerebras models
const CEREBRAS_MODELS = [
	{ name: 'GPT OSS 120B', value: 'gpt-oss-120b' },
	{ name: 'Llama 3.3 70B', value: 'llama-3.3-70b' },
	{ name: 'Llama 4 Maverick 17B', value: 'llama-4-maverick-17b-128e-instruct' },
	{ name: 'Llama 4 Scout 17B', value: 'llama-4-scout-17b-16e-instruct' },
	{ name: 'Llama 3.1 8B', value: 'llama3.1-8b' },
	{ name: 'Qwen 3 235B Instruct', value: 'qwen-3-235b-a22b-instruct-2507' },
	{ name: 'Qwen 3 235B Thinking', value: 'qwen-3-235b-a22b-thinking-2507' },
	{ name: 'Qwen 3 32B', value: 'qwen-3-32b' },
	{ name: 'Qwen 3 Coder 480B', value: 'qwen-3-coder-480b' },
];

export class Cerebras implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cerebras AI',
		name: 'cerebras',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
		icon: 'file:cerebras.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["model"]}}',
		description: 'Interact with Cerebras AI inference API using OpenAI-compatible endpoints',
		defaults: {
			name: 'Cerebras AI',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'cerebrasApi',
				required: true,
			},
		],
		properties: [
			// Model selection
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: CEREBRAS_MODELS,
				default: 'llama3.1-8b',
				description: 'The Cerebras model to use for the request',
			},

			// Simple prompt for easy use
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				placeholder: 'Enter your prompt or question...',
				description: 'Your prompt or question for the AI',
			},

			// Optional system message
			{
				displayName: 'System Message',
				name: 'systemMessage',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
				placeholder: 'Optional: Set the AI\'s behavior (e.g., "You are a helpful assistant")',
				description: 'Optional system message to set the AI\'s behavior and context',
			},

			// Advanced parameters
			{
				displayName: 'Advanced Parameters',
				name: 'advancedParameters',
				type: 'collection',
				placeholder: 'Add Parameter',
				default: {},
				options: [
					{
						displayName: 'Frequency Penalty',
						name: 'frequency_penalty',
						type: 'number',
						typeOptions: {
							minValue: -2,
							maxValue: 2,
							numberStepSize: 0.1,
						},
						default: 0,
						description: 'Penalize repeated tokens based on frequency',
					},
					{
						displayName: 'Max Tokens',
						name: 'max_tokens',
						type: 'number',
						typeOptions: {
							minValue: 1,
							maxValue: 8192,
						},
						default: 1000,
						description: 'Maximum number of tokens to generate',
					},
					{
						displayName: 'Presence Penalty',
						name: 'presence_penalty',
						type: 'number',
						typeOptions: {
							minValue: -2,
							maxValue: 2,
							numberStepSize: 0.1,
						},
						default: 0,
						description: 'Penalize repeated tokens based on presence',
					},
					{
						displayName: 'Stop Sequences',
						name: 'stop',
						type: 'string',
						default: '',
						placeholder: 'Enter stop sequences separated by commas',
						description: 'Sequences where the API will stop generating tokens',
					},
					{
						displayName: 'Stream Response',
						name: 'stream',
						type: 'boolean',
						default: false,
						description: 'Whether to stream the response (Note: n8n will collect all chunks)',
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 2,
							numberStepSize: 0.1,
						},
						default: 0.7,
						description: 'Controls randomness. Higher values make output more random.',
					},
					{
						displayName: 'Top P',
						name: 'top_p',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberStepSize: 0.1,
						},
						default: 1,
						description: 'Controls diversity via nucleus sampling',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Get credentials
		const credentials = await this.getCredentials('cerebrasApi');
		const apiKey = credentials.apiKey as string;

		// Initialize OpenAI client with Cerebras endpoints
		const openai = new OpenAI({
			apiKey,
			baseURL: 'https://api.cerebras.ai/v1',
		});

		for (let i = 0; i < items.length; i++) {
			try {
				const model = this.getNodeParameter('model', i) as string;
				const prompt = this.getNodeParameter('prompt', i) as string;
				const systemMessage = this.getNodeParameter('systemMessage', i) as string;
				const advancedParameters = this.getNodeParameter('advancedParameters', i) as any;

				if (!prompt) {
					throw new NodeOperationError(this.getNode(), 'Prompt is required', {
						itemIndex: i,
					});
				}

				// Build messages array
				const messages: ChatCompletionMessageParam[] = [];
				
				// Add system message if provided
				if (systemMessage) {
					messages.push({
						role: 'system',
						content: systemMessage,
					});
				}

				// Add user prompt
				messages.push({
					role: 'user',
					content: prompt,
				});

				// Build request parameters
				const requestParams: any = {
					model,
					messages,
					...buildAdvancedParameters(advancedParameters),
				};

				// Make chat completion request
				const response = await openai.chat.completions.create(requestParams);

				returnData.push({
					json: {
						...response,
						model,
						operation: 'chatCompletion',
					},
				});
			} catch (error) {
				// Handle OpenAI SDK errors
				if (error instanceof OpenAI.APIError) {
					const errorMessage = formatApiError(error);
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								error: errorMessage,
								model: this.getNodeParameter('model', i),
								operation: 'chatCompletion',
							},
						});
						continue;
					}
					throw new NodeOperationError(this.getNode(), errorMessage, { itemIndex: i });
				}

				// Handle other errors
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							model: this.getNodeParameter('model', i),
							operation: 'chatCompletion',
						},
					});
					continue;
				}
				throw error;
			}
		}

		return this.prepareOutputData(returnData);
	}

}

// Helper functions
function buildAdvancedParameters(advancedParameters: any): any {
	const params: any = {};

	if (advancedParameters.temperature !== undefined) {
		params.temperature = advancedParameters.temperature;
	}
	if (advancedParameters.max_tokens !== undefined) {
		params.max_tokens = advancedParameters.max_tokens;
	}
	if (advancedParameters.top_p !== undefined) {
		params.top_p = advancedParameters.top_p;
	}
	if (advancedParameters.frequency_penalty !== undefined) {
		params.frequency_penalty = advancedParameters.frequency_penalty;
	}
	if (advancedParameters.presence_penalty !== undefined) {
		params.presence_penalty = advancedParameters.presence_penalty;
	}
	if (advancedParameters.stop) {
		params.stop = advancedParameters.stop
			.split(',')
			.map((s: string) => s.trim())
			.filter(Boolean);
	}
	if (advancedParameters.stream !== undefined) {
		params.stream = advancedParameters.stream;
	}

	return params;
}

function formatApiError(error: APIError): string {
	if (error.status === 401) {
		return 'Authentication failed. Please check your Cerebras API key.';
	} else if (error.status === 429) {
		return 'Rate limit exceeded. Please try again later.';
	} else if (error.status === 400) {
		return `Bad request: ${error.message}`;
	} else if (error.status === 500) {
		return 'Cerebras API server error. Please try again later.';
	} else {
		return `Cerebras API error: ${error.message}`;
	}
}