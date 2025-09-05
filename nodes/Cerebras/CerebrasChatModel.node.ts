import {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
} from 'n8n-workflow';

import { ChatOpenAI, ChatOpenAICallOptions } from '@langchain/openai';

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
		displayName: 'Cerebras Chat Model',
		name: 'cerebrasChatModel',
		icon: 'file:cerebras.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["model"]}}',
		description: 'Language model for AI Agent nodes',
		defaults: {
			name: 'Cerebras Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root AI'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://inference-docs.cerebras.ai/',
					},
				],
			},
		},
		inputs: [],
		outputs: ['ai_languageModel'],
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
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional parameters to customize the AI model',
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

	async supplyData(this: ISupplyDataFunctions, itemIndex: number) {
		const credentials = await this.getCredentials('cerebrasApi');
		const apiKey = credentials.apiKey as string;
		
		const model = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex) as any;

		const chatModel = new ChatOpenAI({
			modelName: model,
			temperature: options.temperature as number ?? 0.7,
			maxTokens: options.maxTokens as number ?? 1000,
			topP: options.topP as number ?? 1,
			frequencyPenalty: options.frequencyPenalty as number ?? 0,
			presencePenalty: options.presencePenalty as number ?? 0,
			openAIApiKey: apiKey,
			configuration: {
				baseURL: 'https://api.cerebras.ai/v1',
			},
		} as Partial<ChatOpenAICallOptions>);

		return {
			response: chatModel,
		};
	}
}