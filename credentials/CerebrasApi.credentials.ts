import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CerebrasApi implements ICredentialType {
	name = 'cerebrasApi';
	displayName = 'Cerebras API';
	
	documentationUrl = 'https://inference-docs.cerebras.ai/';
	
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder: 'Enter your Cerebras API key',
			description: 'Your Cerebras API key. You can find it in your Cerebras dashboard.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{ $credentials.apiKey }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.cerebras.ai/v1',
			url: '/models',
			method: 'GET',
		},
	};
}
