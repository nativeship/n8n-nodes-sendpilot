import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class SendpilotApi implements ICredentialType {
  name = "sendpilotApi";
  displayName = "SendPilot API";
  documentationUrl = "https://nativeship.io/nodes/@nativeship/n8n-nodes-sendpilot";
  icon: Icon = {
        light: "file:../nodes/Sendpilot/sendpilot.svg",
        dark: "file:../nodes/Sendpilot/sendpilot.dark.svg"
    };
  properties: INodeProperties[] = [
        {
            displayName: "X-API-Key",
            name: "secret",
            type: "string",
            typeOptions: {
                password: true
            },
            default: "",
            required: true
        }
    ];
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            headers: {
                "X-API-Key": "={{$credentials.secret}}"
            }
        }
    };
  test: ICredentialTestRequest = {
        request: {
            baseURL: "https://api.sendpilot.ai",
            url: "/v1/campaigns"
        }
    };
}
