"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendpilotApi = void 0;
class SendpilotApi {
    constructor() {
        this.name = "sendpilotApi";
        this.displayName = "SendPilot API";
        this.documentationUrl = "https://nativeship.io/nodes/@nativeship/n8n-nodes-sendpilot";
        this.icon = {
            light: "file:../nodes/Sendpilot/sendpilot.svg",
            dark: "file:../nodes/Sendpilot/sendpilot.dark.svg"
        };
        this.properties = [
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
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    "X-API-Key": "={{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://api.sendpilot.ai",
                url: "/v1/campaigns"
            }
        };
    }
}
exports.SendpilotApi = SendpilotApi;
//# sourceMappingURL=SendpilotApi.credentials.js.map