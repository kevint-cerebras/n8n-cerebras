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
		icon: 'file:cerebras.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
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
			// Operation selector
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Chat Completion',
						value: 'chatCompletion',
						description: 'Generate a chat completion using messages',
						action: 'Create a chat completion',
					},
					{
						name: 'Text Completion',
						value: 'textCompletion',
						description: 'Generate a text completion from a prompt',
						action: 'Create a text completion',
					},
				],
				default: 'chatCompletion',
			},

			// Model selection
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: CEREBRAS_MODELS,
				default: 'llama3.1-8b',
				description: 'The Cerebras model to use for the request',
			},

			// Chat completion fields
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						operation: ['chatCompletion'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				default: {
					values: [
						{
							role: 'user',
							content: '',
						},
					],
				},
				options: [
					{
						name: 'values',
						displayName: 'Message',
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								options: [
									{
										name: 'System',
										value: 'system',
									},
									{
										name: 'User',
										value: 'user',
									},
									{
										name: 'Assistant',
										value: 'assistant',
									},
								],
								default: 'user',
							},
							{
								displayName: 'Content',
								name: 'content',
								type: 'string',
								typeOptions: {
									rows: 4,
								},
								default: '',
								placeholder: 'Enter the message content...',
							},
						],
					},
				],
			},

			// Text completion fields
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['textCompletion'],
					},
				},
				typeOptions: {
					rows: 4,
				},
				default: '',
				placeholder: 'Enter your prompt...',
				description: 'The prompt to generate completion for',
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
				const operation = this.getNodeParameter('operation', i) as string;
				const model = this.getNodeParameter('model', i) as string;
				const advancedParameters = this.getNodeParameter('advancedParameters', i) as any;

				let response: any;

				if (operation === 'chatCompletion') {
					// Get messages
					const messages = this.getNodeParameter('messages', i) as any;
					const messagesData = messages.values as ChatCompletionMessageParam[];

					if (!messagesData || messagesData.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'At least one message is required for chat completion',
							{
								itemIndex: i,
							},
						);
					}

					// Build request parameters
					const requestParams: any = {
						model,
						messages: messagesData,
						...buildAdvancedParameters(advancedParameters),
					};

					// Make chat completion request
					response = await openai.chat.completions.create(requestParams);
				} else if (operation === 'textCompletion') {
					// Get prompt
					const prompt = this.getNodeParameter('prompt', i) as string;

					if (!prompt) {
						throw new NodeOperationError(this.getNode(), 'Prompt is required for text completion', {
							itemIndex: i,
						});
					}

					// Build request parameters
					const requestParams: any = {
						model,
						prompt,
						...buildAdvancedParameters(advancedParameters),
					};

					// Make completion request
					response = await openai.completions.create(requestParams);
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, {
						itemIndex: i,
					});
				}

				returnData.push({
					json: {
						...response,
						model,
						operation,
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
								operation: this.getNodeParameter('operation', i),
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
							operation: this.getNodeParameter('operation', i),
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