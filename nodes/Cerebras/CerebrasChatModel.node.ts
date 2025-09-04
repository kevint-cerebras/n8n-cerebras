import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import OpenAI from 'openai';
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

export class CerebrasChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cerebras AI',
		name: 'cerebrasChatModel',
		icon: 'file:cerebras.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["model"]}}',
		description: 'Ultra-fast AI chat completions with Cerebras models',
		defaults: {
			name: 'Cerebras AI',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://inference-docs.cerebras.ai/',
					},
				],
			},
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'cerebrasApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				description: 'The Cerebras model to use for chat completion',
				typeOptions: {
					noDataExpression: true,
				},
				options: CEREBRAS_MODELS,
				default: 'llama3.1-8b',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				description: 'The message or question to send to the AI model',
				typeOptions: {
					rows: 4,
				},
				default: '',
				placeholder: 'What would you like to know?',
			},
			{
				displayName: 'System Message',
				name: 'systemMessage',
				type: 'string',
				description: 'System message to set the behavior and context for the AI',
				typeOptions: {
					rows: 2,
				},
				default: 'You are a helpful AI assistant.',
				placeholder: 'You are a helpful AI assistant.',
			},
			{
				displayName: 'Advanced Parameters',
				name: 'advancedParameters',
				placeholder: 'Add Parameter',
				description: 'Additional parameters to customize the AI response',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberStepSize: 0.1 },
						description: 'Penalize repeated tokens based on frequency',
						type: 'number',
					},
					{
						displayName: 'Max Tokens',
						name: 'maxTokens',
						default: 1000,
						description: 'Maximum number of tokens to generate',
						type: 'number',
						typeOptions: {
							maxValue: 65536,
							minValue: 1,
						},
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberStepSize: 0.1 },
						description: 'Penalize repeated tokens based on presence',
						type: 'number',
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberStepSize: 0.1 },
						description: 'Controls randomness: Lowering results in less random completions',
						type: 'number',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						default: 1,
						typeOptions: { maxValue: 1, minValue: 0, numberStepSize: 0.1 },
						description: 'Controls diversity via nucleus sampling',
						type: 'number',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('cerebrasApi');
		const apiKey = credentials.apiKey as string;

		const openai = new OpenAI({
			apiKey,
			baseURL: 'https://api.cerebras.ai/v1',
		});

		for (let i = 0; i < items.length; i++) {
			try {
				const model = this.getNodeParameter('model', i) as string;
				const prompt = this.getNodeParameter('prompt', i) as string;
				const systemMessage = this.getNodeParameter('systemMessage', i) as string;
				const advancedParameters = this.getNodeParameter('advancedParameters', i, {}) as any;

				if (!prompt) {
					throw new NodeOperationError(this.getNode(), 'Prompt is required', { itemIndex: i });
				}

				const messages = [
					{
						role: 'system' as const,
						content: systemMessage,
					},
					{
						role: 'user' as const,
						content: prompt,
					},
				];

				const completion = await openai.chat.completions.create({
					model,
					messages,
					temperature: advancedParameters.temperature ?? 0.7,
					max_tokens: advancedParameters.maxTokens ?? 1000,
					top_p: advancedParameters.topP ?? 1,
					frequency_penalty: advancedParameters.frequencyPenalty ?? 0,
					presence_penalty: advancedParameters.presencePenalty ?? 0,
				});

				const response = completion.choices[0]?.message?.content || '';

				returnData.push({
					json: {
						model,
						prompt,
						response,
						usage: completion.usage,
						finishReason: completion.choices[0]?.finish_reason,
					},
				});
			} catch (error) {
				if (error instanceof Error && 'status' in error) {
					const apiError = error as APIError;
					throw new NodeOperationError(
						this.getNode(),
						`Cerebras API Error (${apiError.status}): ${apiError.message}`,
						{ itemIndex: i },
					);
				}
				throw new NodeOperationError(this.getNode(), `Error: ${error}`, { itemIndex: i });
			}
		}

		return [returnData];
	}
}