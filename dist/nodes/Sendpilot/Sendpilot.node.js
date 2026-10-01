"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sendpilot = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const http_1 = require("../../shared/http");
function normalizeParameterValue(value) {
    if (value && typeof value === 'object' && 'value' in value)
        return value.value;
    return value;
}
function normalizeJsonValue(value, label, context, itemIndex) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return {};
        try {
            return JSON.parse(trimmed);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON: ${error.message}`, { itemIndex });
        }
    }
    if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}
function validateBodyValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c, _d, _e;
    if (value === undefined || value === '') {
        if (contract.required)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
        return;
    }
    if (value === null) {
        if (contract.nullable)
            return;
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
    }
    if ((_a = contract.alternatives) === null || _a === void 0 ? void 0 : _a.length) {
        selectAlternativeValue(value, contract, path, context, itemIndex);
        return;
    }
    if (contract.type === 'string' && typeof value !== 'string')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
    if (contract.type === 'boolean' && typeof value !== 'boolean')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
    if (contract.type === 'number' && typeof value !== 'number')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
    if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value)))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
    if ((_b = contract.enum) === null || _b === void 0 ? void 0 : _b.length) {
        const enumValueMatches = (candidate) => candidate === value ||
            (candidate === null && value === 'null') ||
            (candidate === 'null' && value === null) ||
            Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
        const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
        const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
            ? value.every((item) => contract.enum.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
            : contract.enum.some(enumValueMatches);
        if (!matches)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
    }
    if (contract.type === 'number' || contract.type === 'integer') {
        const numeric = value;
        if (contract.minValue !== undefined && numeric < contract.minValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
        if (contract.maxValue !== undefined && numeric > contract.maxValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
    }
    if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
    if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
    if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
        try {
            new URL(value);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
        }
    }
    if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
    if (contract.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
        const objectValue = value;
        for (const child of (_c = contract.fields) !== null && _c !== void 0 ? _c : [])
            validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
        if (contract.additionalValue) {
            const known = new Set(((_d = contract.fields) !== null && _d !== void 0 ? _d : []).map((field) => field.name));
            for (const [key, childValue] of Object.entries(objectValue)) {
                if (!known.has(key)) {
                    if (((_e = contract.additionalValue.alternatives) === null || _e === void 0 ? void 0 : _e.length) && contract.additionalValue.representation === 'raw')
                        continue;
                    validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
                }
            }
        }
    }
    if (contract.type === 'array') {
        if (!Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
        if (contract.items)
            value.forEach((item, index) => validateBodyValue(item, contract.items, `${path}[${index}]`, context, itemIndex));
    }
}
function setBodyField(body, contract, value, context, itemIndex) {
    var _a, _b;
    const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
        ? normalizeJsonValue(value, (_a = contract.displayName) !== null && _a !== void 0 ? _a : contract.name, context, itemIndex)
        : normalizeParameterValue(value);
    const selected = ((_b = contract.alternatives) === null || _b === void 0 ? void 0 : _b.length) ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
    validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
    body[contract.name] = selected;
}
function selectAlternativeValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
    const selectedName = String((_a = value.schemaAlternative) !== null && _a !== void 0 ? _a : '');
    const selected = ((_b = contract.alternatives) !== null && _b !== void 0 ? _b : []).find((alternative) => alternative.name === selectedName);
    if (!selected)
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${((_c = contract.alternatives) !== null && _c !== void 0 ? _c : []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
    const selectedValue = value.value;
    validateBodyValue(selectedValue, selected, path, context, itemIndex);
    return selectedValue;
}
function selectResponseFields(value, fields) {
    if (fields.length === 0)
        return value;
    const selected = {};
    if (value.id !== undefined)
        selected.id = value.id;
    for (const field of fields)
        if (value[field] !== undefined)
            selected[field] = value[field];
    return selected;
}
function valueAtPath(value, path) {
    if (!path)
        return value;
    return path.split('.').filter(Boolean).reduce((current, segment) => {
        if (current === undefined || current === null)
            return undefined;
        if (Array.isArray(current))
            return current[Number(segment)];
        return current[segment];
    }, value);
}
class Sendpilot {
    constructor() {
        this.description = {
            displayName: "SendPilot",
            name: "sendpilot",
            icon: {
                light: "file:sendpilot.svg",
                dark: "file:sendpilot.dark.svg"
            },
            group: [],
            version: [
                1
            ],
            subtitle: "={{((JSON.parse(\"\\u007b\\\"campaigns\\\":\\u007b\\\"campaigns.get\\\":\\\"getCampaign: campaign\\\",\\\"campaigns.list\\\":\\\"listCampaigns: campaign\\\",\\\"campaigns.update\\\":\\\"updateCampaign: campaign\\\"\\u007d,\\\"credits\\\":\\u007b\\\"credits.get\\\":\\\"getCredits: credit\\\"\\u007d,\\\"externalApiLeadDatabase\\\":\\u007b\\\"leadDatabase.filters\\\":\\\"listLeadFiltersAndValues: externalApiLeadDatabase\\\"\\u007d,\\\"externalApiSenders\\\":\\u007b\\\"senders.quotas\\\":\\\"getDailyLinkedInQuotasPerSender: externalApiSender\\\"\\u007d,\\\"externalApiWorkspace\\\":\\u007b\\\"workspace.me\\\":\\\"getCurrentApiKeyAndWorkspace: externalApiWorkspace\\\"\\u007d,\\\"inbox\\\":\\u007b\\\"inbox.listConversations\\\":\\\"getManyConversations: inbox\\\",\\\"inbox.listMessages\\\":\\\"getConversationMessages: inbox\\\",\\\"inbox.listSenders\\\":\\\"getManySenders: inbox\\\",\\\"inbox.sendConnectionRequest\\\":\\\"sendConnectionRequest: inbox\\\",\\\"inbox.sendMessage\\\":\\\"sendMessage: inbox\\\",\\\"inbox.sendMessageToLead\\\":\\\"sendMessageToLead: inbox\\\"\\u007d,\\\"leadDatabase\\\":\\u007b\\\"leadDatabase.getSearchResults\\\":\\\"getDatabaseSearchResults: leadDatabase\\\",\\\"leadDatabase.getSearchStatus\\\":\\\"getDatabaseSearchStatus: leadDatabase\\\",\\\"leadDatabase.startSearch\\\":\\\"createDatabaseSearch: leadDatabase\\\"\\u007d,\\\"leadExtractor\\\":\\u007b\\\"leadExtractor.getResults\\\":\\\"getExtractorCampaignResults: leadExtractor\\\",\\\"leadExtractor.getStatus\\\":\\\"getExtractorCampaignStatus: leadExtractor\\\",\\\"leadExtractor.startExtraction\\\":\\\"createLeadExtractorCampaign: leadExtractor\\\"\\u007d,\\\"leads\\\":\\u007b\\\"leads.add\\\":\\\"addLeadsToCampaign: lead\\\",\\\"leads.get\\\":\\\"getLead: lead\\\",\\\"leads.list\\\":\\\"getManyLeads: lead\\\",\\\"leads.updateStatus\\\":\\\"updateLeadStatus: lead\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
            description: "Manage LinkedIn outreach campaigns, track lead statuses, and monitor credit balances with SendPilot",
            documentationUrl: "https://nativeship.io/nodes/@nativeship/n8n-nodes-sendpilot",
            hints: [
                {
                    message: "Operation \"campaigns.list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"leadDatabase.filters\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"leadDatabase.getSearchResults\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"leadExtractor.getResults\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"leads.list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                }
            ],
            defaults: {
                name: "SendPilot"
            },
            usableAsTool: true,
            inputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            outputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            credentials: [
                {
                    name: "sendpilotApi",
                    required: true
                }
            ],
            properties: [
                {
                    displayName: "Resource",
                    name: "resource",
                    type: "options",
                    noDataExpression: true,
                    default: "campaigns",
                    options: [
                        {
                            name: "Campaign",
                            value: "campaigns"
                        },
                        {
                            name: "Credit",
                            value: "credits"
                        },
                        {
                            name: "External API Lead Database",
                            value: "externalApiLeadDatabase"
                        },
                        {
                            name: "External API Sender",
                            value: "externalApiSenders"
                        },
                        {
                            name: "External API Workspace",
                            value: "externalApiWorkspace"
                        },
                        {
                            name: "Inbox",
                            value: "inbox"
                        },
                        {
                            name: "Lead",
                            value: "leads"
                        },
                        {
                            name: "Lead Database",
                            value: "leadDatabase"
                        },
                        {
                            name: "Lead Extractor",
                            value: "leadExtractor"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "campaigns"
                            ]
                        }
                    },
                    default: "campaigns.get",
                    options: [
                        {
                            name: "Get",
                            value: "campaigns.get",
                            action: "Get campaign",
                            description: "Retrieves detailed configuration, lead metrics, and connected sender accounts for a specific campaign"
                        },
                        {
                            name: "List",
                            value: "campaigns.list",
                            action: "List campaigns",
                            description: "Retrieves a paginated list of linkedin outreach campaigns filtered by status"
                        },
                        {
                            name: "Update",
                            value: "campaigns.update",
                            action: "Update campaign",
                            description: "Pauses or resumes an existing outreach campaign"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Campaign ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "campaigns"
                            ],
                            operation: [
                                "campaigns.get"
                            ]
                        }
                    }
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "campaigns"
                            ],
                            operation: [
                                "campaigns.get"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "name",
                        "status",
                        "type",
                        "createdAt",
                        "updatedAt",
                        "connectionsSent",
                        "leadsContacted",
                        "messagesSent",
                        "repliesReceived"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "campaigns"
                            ],
                            operation: [
                                "campaigns.get"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "ConnectionsSent",
                            value: "connectionsSent"
                        },
                        {
                            name: "CreatedAt",
                            value: "createdAt"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "LeadsContacted",
                            value: "leadsContacted"
                        },
                        {
                            name: "LinkedInSenderIds",
                            value: "linkedInSenderIds"
                        },
                        {
                            name: "MessagesSent",
                            value: "messagesSent"
                        },
                        {
                            name: "Name",
                            value: "name"
                        },
                        {
                            name: "RepliesReceived",
                            value: "repliesReceived"
                        },
                        {
                            name: "Status",
                            value: "status"
                        },
                        {
                            name: "TotalLeads",
                            value: "totalLeads"
                        },
                        {
                            name: "Type",
                            value: "type"
                        },
                        {
                            name: "UpdatedAt",
                            value: "updatedAt"
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "campaigns"
                            ],
                            operation: [
                                "campaigns.list"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "Page number to return (starts at 1)",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 100
                            }
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "options",
                            default: "all",
                            description: "Filter campaigns by status",
                            options: [
                                {
                                    name: "Active",
                                    value: "active"
                                },
                                {
                                    name: "All",
                                    value: "all"
                                },
                                {
                                    name: "Draft",
                                    value: "draft"
                                },
                                {
                                    name: "Finished",
                                    value: "finished"
                                },
                                {
                                    name: "Paused",
                                    value: "paused"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Campaign ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "campaigns"
                            ],
                            operation: [
                                "campaigns.update"
                            ]
                        }
                    }
                },
                {
                    displayName: "Action",
                    name: "action",
                    type: "options",
                    default: "pause",
                    required: true,
                    description: "Pause or resume the campaign",
                    placeholder: "e.g. pause",
                    options: [
                        {
                            name: "Pause",
                            value: "pause",
                            action: "Pause"
                        },
                        {
                            name: "Resume",
                            value: "resume",
                            action: "Resume"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "campaigns"
                            ],
                            operation: [
                                "campaigns.update"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "credits"
                            ]
                        }
                    },
                    default: "credits.get",
                    options: [
                        {
                            name: "Get",
                            value: "credits.get",
                            action: "Get credits",
                            description: "Retrieves current credit balances, subscription quota, and usage across workspace features"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "externalApiLeadDatabase"
                            ]
                        }
                    },
                    default: "leadDatabase.filters",
                    options: [
                        {
                            name: "List Lead Filters And Values",
                            value: "leadDatabase.filters",
                            action: "List lead filters and values external API lead database",
                            description: "Lists supported lead filters. you can also search and paginate the bundled value catalog. this endpoint does not start a search or use credits. external API - lead database."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "externalApiLeadDatabase"
                            ],
                            operation: [
                                "leadDatabase.filters"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Filter",
                            name: "filter",
                            type: "string",
                            default: "",
                            description: "Name of the filter to retrieve. omit this parameter to list all supported filters."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Offset",
                            name: "offset",
                            type: "number",
                            default: 0,
                            description: "Number of catalog values to skip (starts at 0)",
                            typeOptions: {
                                minValue: 0,
                                maxValue: 1000000
                            }
                        },
                        {
                            displayName: "Search",
                            name: "search",
                            type: "string",
                            default: "",
                            description: "Case-insensitive search across filter names and catalog values"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "externalApiSenders"
                            ]
                        }
                    },
                    default: "senders.quotas",
                    options: [
                        {
                            name: "Get Daily LinkedIn Quotas Per Sender",
                            value: "senders.quotas",
                            action: "Get daily linkedin quotas per sender external API senders",
                            description: "Returns each sender's daily connection, message, and like quotas, including usage, remaining amounts, and reset times. external API - senders."
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "externalApiWorkspace"
                            ]
                        }
                    },
                    default: "workspace.me",
                    options: [
                        {
                            name: "Get Current API Key And Workspace",
                            value: "workspace.me",
                            action: "Get current API key and workspace external API workspace",
                            description: "Returns details about the current API key and its workspace, including subscription status, scopes, expiration time, and rate limits. external API - workspace."
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ]
                        }
                    },
                    default: "inbox.listConversations",
                    options: [
                        {
                            name: "Get Conversation Messages",
                            value: "inbox.listMessages",
                            action: "Get conversation messages inbox",
                            description: "Retrieves message history and attachments for a specific linkedin conversation thread. inbox."
                        },
                        {
                            name: "Get Many Conversations",
                            value: "inbox.listConversations",
                            action: "Get many conversations inbox",
                            description: "Retrieves linkedin message threads across connected sender accounts with continuation token pagination. inbox."
                        },
                        {
                            name: "Get Many Senders",
                            value: "inbox.listSenders",
                            action: "Get many senders inbox",
                            description: "Retrieves connected linkedin sender accounts along with daily message limits and usage. inbox."
                        },
                        {
                            name: "Send Connection Request",
                            value: "inbox.sendConnectionRequest",
                            action: "Send connection request inbox",
                            description: "Dispatches a linkedin connection request with an optional note to a target profile. inbox."
                        },
                        {
                            name: "Send Message",
                            value: "inbox.sendMessage",
                            action: "Send message inbox",
                            description: "Sends a direct message to a linkedin profile URL using a connected sender account. inbox."
                        },
                        {
                            name: "Send Message To Lead",
                            value: "inbox.sendMessageToLead",
                            action: "Send message to lead inbox",
                            description: "Sends a templated linkedin message directly to an existing lead by lead ID. inbox."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.listConversations"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "accountId",
                            type: "string",
                            default: "",
                            description: "ID of the linkedin sender whose conversations to return",
                            placeholder: "e.g. sender_123"
                        },
                        {
                            displayName: "Continuation Token",
                            name: "continuationToken",
                            type: "string",
                            default: "",
                            description: "Token for retrieving the next page of conversations",
                            typeOptions: {
                                password: true
                            }
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "Conversation ID",
                    name: "conversationId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the conversation",
                    placeholder: "e.g. 2-OVp-y-UNyFXBYvx0FqmQ",
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.listMessages"
                            ]
                        }
                    }
                },
                {
                    displayName: "Account ID",
                    name: "accountId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the linkedin sender that owns the conversation",
                    placeholder: "e.g. sender_123",
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.listMessages"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.listMessages"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Continuation Token",
                            name: "continuationToken",
                            type: "string",
                            default: "",
                            description: "Token for retrieving the next page of messages",
                            typeOptions: {
                                password: true
                            }
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "Recipient Linkedin URL",
                    name: "recipientLinkedinUrl",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Linkedin profile URL of the person to connect with",
                    placeholder: "e.g. https://www.linkedin.com/in/johndoe/",
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendConnectionRequest"
                            ]
                        }
                    }
                },
                {
                    displayName: "Sender ID",
                    name: "senderId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the connected linkedin sender account to use",
                    placeholder: "e.g. sender_123",
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendConnectionRequest"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendConnectionRequest"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Message",
                            name: "message",
                            type: "string",
                            default: "",
                            description: "Optional connection note, available only for premium linkedin accounts",
                            placeholder: "e.g. Hi John, I would love to connect with you!"
                        }
                    ]
                },
                {
                    displayName: "Message",
                    name: "message",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Text of the linkedin message to send",
                    placeholder: "e.g. Hi John, I wanted to follow up on our conversation...",
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Recipient Linkedin URL",
                    name: "recipientLinkedinUrl",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Linkedin profile URL of the recipient. the recipient must be a first-degree connection of the sender.",
                    placeholder: "e.g. https://www.linkedin.com/in/johndoe/",
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Sender ID",
                    name: "senderId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the connected linkedin sender account to use",
                    placeholder: "e.g. sender_123",
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendMessage"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Campaign ID",
                            name: "campaignId",
                            type: "string",
                            default: "",
                            description: "Optional campaign ID to associate this message with",
                            placeholder: "e.g. campaign_123"
                        },
                        {
                            displayName: "Lead ID",
                            name: "leadId",
                            type: "string",
                            default: "",
                            description: "Optional lead ID to associate this message with",
                            placeholder: "e.g. lead_123"
                        }
                    ]
                },
                {
                    displayName: "Lead ID",
                    name: "leadId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the lead to message",
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendMessageToLead"
                            ]
                        }
                    }
                },
                {
                    displayName: "Message",
                    name: "message",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Message content to send",
                    placeholder: "e.g. Hi {{firstName}}, I wanted to follow up on our conversation...",
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendMessageToLead"
                            ]
                        }
                    }
                },
                {
                    displayName: "Sender ID",
                    name: "senderId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Linkedin sender ID to use",
                    placeholder: "e.g. sender_123",
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendMessageToLead"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "inbox"
                            ],
                            operation: [
                                "inbox.sendMessageToLead"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Campaign ID",
                            name: "campaignId",
                            type: "string",
                            default: "",
                            description: "Optional campaign ID to associate this message with"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "leadDatabase"
                            ]
                        }
                    },
                    default: "leadDatabase.getSearchResults",
                    options: [
                        {
                            name: "Create Database Search",
                            value: "leadDatabase.startSearch",
                            action: "Create database search lead database",
                            description: "Initiates an asynchronous b2b lead search matching professional, company, and technology filters. lead database."
                        },
                        {
                            name: "Get Database Search Results",
                            value: "leadDatabase.getSearchResults",
                            action: "Get database search results lead database",
                            description: "Retrieves paginated lead records and contact details from a completed database search. lead database."
                        },
                        {
                            name: "Get Database Search Status",
                            value: "leadDatabase.getSearchStatus",
                            action: "Get database search status lead database",
                            description: "Checks the execution progress and completion status of a lead database search job"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the lead database search",
                    displayOptions: {
                        show: {
                            resource: [
                                "leadDatabase"
                            ],
                            operation: [
                                "leadDatabase.getSearchResults"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "leadDatabase"
                            ],
                            operation: [
                                "leadDatabase.getSearchResults"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Offset",
                            name: "offset",
                            type: "number",
                            default: 0,
                            description: "Number of leads to skip (starts at 0)",
                            typeOptions: {
                                minValue: 0,
                                maxValue: 10000
                            }
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the lead database search",
                    displayOptions: {
                        show: {
                            resource: [
                                "leadDatabase"
                            ],
                            operation: [
                                "leadDatabase.getSearchStatus"
                            ]
                        }
                    }
                },
                {
                    displayName: "Filters",
                    name: "filters",
                    type: "collection",
                    default: {},
                    placeholder: "Add Field",
                    options: [
                        {
                            displayName: "Acquired End Date",
                            name: "acquired_end_date",
                            type: "string",
                            default: "",
                            description: "Acquisition date range end, dd/mm/yyyy"
                        },
                        {
                            displayName: "Acquired Start Date",
                            name: "acquired_start_date",
                            type: "string",
                            default: "",
                            description: "Acquisition date range start, dd/mm/yyyy"
                        },
                        {
                            displayName: "Bulk Domains",
                            name: "bulk_domains",
                            type: "string",
                            default: "",
                            description: "Company domains separated by commas or newlines"
                        },
                        {
                            displayName: "Companies",
                            name: "companies",
                            type: "json",
                            default: [],
                            description: "Company names"
                        },
                        {
                            displayName: "Company Linkedin Username",
                            name: "company_linkedin_username",
                            type: "json",
                            default: [],
                            description: "Company linkedin usernames or URLs"
                        },
                        {
                            displayName: "Company Sizes",
                            name: "company_sizes",
                            type: "json",
                            default: [],
                            description: "Employee-size ranges"
                        },
                        {
                            displayName: "Company Type",
                            name: "company_type",
                            type: "json",
                            default: [],
                            description: "Company types"
                        },
                        {
                            displayName: "Demo Available",
                            name: "demo_available",
                            type: "boolean",
                            default: false,
                            description: "Whether company offers a demo"
                        },
                        {
                            displayName: "Documentation Exist",
                            name: "documentation_exist",
                            type: "boolean",
                            default: false,
                            description: "Whether company provides documentation"
                        },
                        {
                            displayName: "Excluded Bulk Domains",
                            name: "excluded_bulk_domains",
                            type: "string",
                            default: "",
                            description: "Company domains to exclude, separated by commas or newlines"
                        },
                        {
                            displayName: "Excluded Companies",
                            name: "excluded_companies",
                            type: "json",
                            default: [],
                            description: "Company names to exclude"
                        },
                        {
                            displayName: "Excluded Company Linkedin Username",
                            name: "excluded_company_linkedin_username",
                            type: "json",
                            default: [],
                            description: "Company linkedin usernames or URLs to exclude"
                        },
                        {
                            displayName: "Excluded Company Sizes",
                            name: "excluded_company_sizes",
                            type: "json",
                            default: [],
                            description: "Employee-size codes to exclude, from 1 (one employee) to 9 (10001+)"
                        },
                        {
                            displayName: "Excluded Company Type",
                            name: "excluded_company_type",
                            type: "json",
                            default: [],
                            description: "Company types to exclude"
                        },
                        {
                            displayName: "Excluded Experimental Department",
                            name: "excluded_experimental_department",
                            type: "json",
                            default: [],
                            description: "Compatibility alias for excluded_member_department; do not supply both with different values"
                        },
                        {
                            displayName: "Excluded Experimental Industries",
                            name: "excluded_experimental_industries",
                            type: "json",
                            default: [],
                            description: "Compatibility alias for excluded_industries; do not supply both with different values"
                        },
                        {
                            displayName: "Excluded Hq Location",
                            name: "excluded_hq_location",
                            type: "json",
                            default: [],
                            description: "Headquarters locations to exclude"
                        },
                        {
                            displayName: "Excluded Industries",
                            name: "excluded_industries",
                            type: "json",
                            default: [],
                            description: "Industries to exclude"
                        },
                        {
                            displayName: "Excluded Job Posting Functions",
                            name: "excluded_job_posting_functions",
                            type: "json",
                            default: [],
                            description: "Job functions to exclude"
                        },
                        {
                            displayName: "Excluded Job Posting Location",
                            name: "excluded_job_posting_location",
                            type: "json",
                            default: [],
                            description: "Job posting locations to exclude"
                        },
                        {
                            displayName: "Excluded Job Posting Title",
                            name: "excluded_job_posting_title",
                            type: "json",
                            default: [],
                            description: "Recruiting titles to exclude"
                        },
                        {
                            displayName: "Excluded Job Titles",
                            name: "excluded_job_titles",
                            type: "json",
                            default: [],
                            description: "Job titles to exclude"
                        },
                        {
                            displayName: "Excluded Keywords",
                            name: "excluded_keywords",
                            type: "json",
                            default: [],
                            description: "Company keywords to exclude"
                        },
                        {
                            displayName: "Excluded Locations",
                            name: "excluded_locations",
                            type: "json",
                            default: [],
                            description: "Person locations to exclude"
                        },
                        {
                            displayName: "Excluded Member Certifications",
                            name: "excluded_member_certifications",
                            type: "json",
                            default: [],
                            description: "Certifications to exclude"
                        },
                        {
                            displayName: "Excluded Member Department",
                            name: "excluded_member_department",
                            type: "json",
                            default: [],
                            description: "Departments to exclude"
                        },
                        {
                            displayName: "Excluded Member Description",
                            name: "excluded_member_description",
                            type: "json",
                            default: [],
                            description: "Profile-summary keywords to exclude"
                        },
                        {
                            displayName: "Excluded Member Linkedin Username",
                            name: "excluded_member_linkedin_username",
                            type: "json",
                            default: [],
                            description: "Linkedin usernames or profile URLs to exclude"
                        },
                        {
                            displayName: "Excluded Member Skills",
                            name: "excluded_member_skills",
                            type: "json",
                            default: [],
                            description: "Profile skills to exclude"
                        },
                        {
                            displayName: "Excluded Naics Codes",
                            name: "excluded_naics_codes",
                            type: "json",
                            default: [],
                            description: "Naics code strings to exclude"
                        },
                        {
                            displayName: "Excluded Seniority Levels",
                            name: "excluded_seniority_levels",
                            type: "json",
                            default: [],
                            description: "Seniority levels to exclude"
                        },
                        {
                            displayName: "Excluded Sic Codes",
                            name: "excluded_sic_codes",
                            type: "json",
                            default: [],
                            description: "Sic code strings to exclude"
                        },
                        {
                            displayName: "Excluded Technologies Used",
                            name: "excluded_technologies_used",
                            type: "json",
                            default: [],
                            description: "Company technologies to exclude"
                        },
                        {
                            displayName: "Excluded Top Topics",
                            name: "excluded_top_topics",
                            type: "json",
                            default: [],
                            description: "Website topics to exclude"
                        },
                        {
                            displayName: "Experimental Industries",
                            name: "experimental_industries",
                            type: "json",
                            default: [],
                            description: "Compatibility alias for industries; do not supply both with different values"
                        },
                        {
                            displayName: "Experimental Member Department",
                            name: "experimental_member_department",
                            type: "json",
                            default: [],
                            description: "Compatibility alias for member_department; do not supply both with different values"
                        },
                        {
                            displayName: "Free Trial Available",
                            name: "free_trial_available",
                            type: "boolean",
                            default: false,
                            description: "Whether company offers a free trial"
                        },
                        {
                            displayName: "Hq Location",
                            name: "hq_location",
                            type: "json",
                            default: [],
                            description: "Company headquarters locations"
                        },
                        {
                            displayName: "Industries",
                            name: "industries",
                            type: "json",
                            default: [],
                            description: "Company industries. uses the supported experimental_industries provider field; query the catalog for values."
                        },
                        {
                            displayName: "Ipo End Date",
                            name: "ipo_end_date",
                            type: "string",
                            default: "",
                            description: "Ipo date range end, dd/mm/yyyy"
                        },
                        {
                            displayName: "Ipo Start Date",
                            name: "ipo_start_date",
                            type: "string",
                            default: "",
                            description: "Ipo date range start, dd/mm/yyyy"
                        },
                        {
                            displayName: "Is Downloadable",
                            name: "is_downloadable",
                            type: "boolean",
                            default: false,
                            description: "Whether company offers downloadable software/resources"
                        },
                        {
                            displayName: "Is Mapped Industries Strict",
                            name: "is_mapped_industries_strict",
                            type: "boolean",
                            default: false,
                            description: "Whether true requires exact industry matching; false lets the provider match related industries"
                        },
                        {
                            displayName: "Job Posting End Date",
                            name: "job_posting_end_date",
                            type: "string",
                            default: "",
                            description: "Job posting date range end, dd/mm/yyyy"
                        },
                        {
                            displayName: "Job Posting Location",
                            name: "job_posting_location",
                            type: "json",
                            default: [],
                            description: "Job posting locations"
                        },
                        {
                            displayName: "Job Posting Seniority",
                            name: "job_posting_seniority",
                            type: "json",
                            default: [],
                            description: "Recruiting seniority levels"
                        },
                        {
                            displayName: "Job Posting Start Date",
                            name: "job_posting_start_date",
                            type: "string",
                            default: "",
                            description: "Job posting date range start, dd/mm/yyyy"
                        },
                        {
                            displayName: "Job Posting Title",
                            name: "job_posting_title",
                            type: "json",
                            default: [],
                            description: "Job titles the company is recruiting"
                        },
                        {
                            displayName: "Job Posting Type",
                            name: "job_posting_type",
                            type: "json",
                            default: [],
                            description: "Employment types"
                        },
                        {
                            displayName: "Job Title Match Mode",
                            name: "job_title_match_mode",
                            type: "options",
                            default: "exact",
                            description: "Job-title matching: exact, contains (provider default), or smart",
                            options: [
                                {
                                    name: "Contains",
                                    value: "contains"
                                },
                                {
                                    name: "Exact",
                                    value: "exact"
                                },
                                {
                                    name: "Smart",
                                    value: "smart"
                                }
                            ]
                        },
                        {
                            displayName: "Job Title Smart Mode",
                            name: "job_title_smart_mode",
                            type: "options",
                            default: "loose",
                            description: "Sensitivity when job_title_match_mode is smart",
                            options: [
                                {
                                    name: "Loose",
                                    value: "loose"
                                },
                                {
                                    name: "Normal",
                                    value: "normal"
                                },
                                {
                                    name: "Strict",
                                    value: "strict"
                                }
                            ]
                        },
                        {
                            displayName: "Job Titles",
                            name: "job_titles",
                            type: "json",
                            default: [],
                            description: "Current job titles. use the filter catalog for suggested values."
                        },
                        {
                            displayName: "Keywords",
                            name: "keywords",
                            type: "json",
                            default: [],
                            description: "Keywords in company descriptions or specialties"
                        },
                        {
                            displayName: "Last Funding Round Name",
                            name: "last_funding_round_name",
                            type: "json",
                            default: [],
                            description: "Latest funding-round types"
                        },
                        {
                            displayName: "Locations",
                            name: "locations",
                            type: "json",
                            default: [],
                            description: "Person country, region or city"
                        },
                        {
                            displayName: "Max Average Visit Duration Seconds",
                            name: "max_average_visit_duration_seconds",
                            type: "number",
                            default: 0,
                            description: "Maximum visit duration in seconds",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Max Bounce Rate",
                            name: "max_bounce_rate",
                            type: "number",
                            default: 0,
                            description: "Maximum bounce-rate percentage",
                            typeOptions: {
                                minValue: 0,
                                maxValue: 100
                            }
                        },
                        {
                            displayName: "Max Company Employee Reviews Aggregate Score",
                            name: "max_company_employee_reviews_aggregate_score",
                            type: "number",
                            default: 0,
                            description: "Maximum employee-review score",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Max Job Duration Months",
                            name: "max_job_duration_months",
                            type: "number",
                            default: 0,
                            description: "Maximum time in the current job, in months",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Max Last Funding Round Amount Raised",
                            name: "max_last_funding_round_amount_raised",
                            type: "number",
                            default: 0,
                            description: "Maximum latest funding amount",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Max Pages Per Visit",
                            name: "max_pages_per_visit",
                            type: "number",
                            default: 0,
                            description: "Maximum average pages per visit",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Max Rank Category",
                            name: "max_rank_category",
                            type: "number",
                            default: 0,
                            description: "Maximum website rank within its category",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Max Rank Country",
                            name: "max_rank_country",
                            type: "number",
                            default: 0,
                            description: "Maximum website rank within its country",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Max Rank Global",
                            name: "max_rank_global",
                            type: "number",
                            default: 0,
                            description: "Maximum global website rank",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Max Revenue Annual",
                            name: "max_revenue_annual",
                            type: "number",
                            default: 0,
                            description: "Maximum annual revenue",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Max Total Experience Duration Months",
                            name: "max_total_experience_duration_months",
                            type: "number",
                            default: 0,
                            description: "Maximum total experience in months",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Max Total Website Visits Monthly",
                            name: "max_total_website_visits_monthly",
                            type: "number",
                            default: 0,
                            description: "Maximum monthly website visits",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Member Certifications",
                            name: "member_certifications",
                            type: "json",
                            default: [],
                            description: "Professional certifications"
                        },
                        {
                            displayName: "Member Department",
                            name: "member_department",
                            type: "json",
                            default: [],
                            description: "Departments; mapped to the supported provider department filter"
                        },
                        {
                            displayName: "Member Description",
                            name: "member_description",
                            type: "json",
                            default: [],
                            description: "Keywords in profile summaries"
                        },
                        {
                            displayName: "Member Full Name",
                            name: "member_full_name",
                            type: "string",
                            default: "",
                            description: "Person name search"
                        },
                        {
                            displayName: "Member Linkedin Username",
                            name: "member_linkedin_username",
                            type: "json",
                            default: [],
                            description: "Linkedin usernames or profile URLs"
                        },
                        {
                            displayName: "Member Skills",
                            name: "member_skills",
                            type: "json",
                            default: [],
                            description: "Profile skills"
                        },
                        {
                            displayName: "Min Average Visit Duration Seconds",
                            name: "min_average_visit_duration_seconds",
                            type: "number",
                            default: 0,
                            description: "Minimum visit duration in seconds",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Bounce Rate",
                            name: "min_bounce_rate",
                            type: "number",
                            default: 0,
                            description: "Minimum bounce-rate percentage",
                            typeOptions: {
                                minValue: 0,
                                maxValue: 100
                            }
                        },
                        {
                            displayName: "Min Company Employee Reviews Aggregate Score",
                            name: "min_company_employee_reviews_aggregate_score",
                            type: "number",
                            default: 0,
                            description: "Minimum employee-review score",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Job Duration Months",
                            name: "min_job_duration_months",
                            type: "number",
                            default: 0,
                            description: "Minimum time in the current job, in months",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Last Funding Round Amount Raised",
                            name: "min_last_funding_round_amount_raised",
                            type: "number",
                            default: 0,
                            description: "Minimum latest funding amount",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Pages Per Visit",
                            name: "min_pages_per_visit",
                            type: "number",
                            default: 0,
                            description: "Minimum average pages per visit",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Rank Category",
                            name: "min_rank_category",
                            type: "number",
                            default: 0,
                            description: "Minimum website rank within its category",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Rank Country",
                            name: "min_rank_country",
                            type: "number",
                            default: 0,
                            description: "Minimum website rank within its country",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Rank Global",
                            name: "min_rank_global",
                            type: "number",
                            default: 0,
                            description: "Minimum global website rank",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Revenue Annual",
                            name: "min_revenue_annual",
                            type: "number",
                            default: 0,
                            description: "Minimum annual revenue",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Total Experience Duration Months",
                            name: "min_total_experience_duration_months",
                            type: "number",
                            default: 0,
                            description: "Minimum total experience in months",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Total Website Visits Monthly",
                            name: "min_total_website_visits_monthly",
                            type: "number",
                            default: 0,
                            description: "Minimum monthly website visits",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Mobile Apps Exist",
                            name: "mobile_apps_exist",
                            type: "boolean",
                            default: false,
                            description: "Whether company has mobile apps"
                        },
                        {
                            displayName: "Naics Codes",
                            name: "naics_codes",
                            type: "json",
                            default: [],
                            description: "Naics code objects from the catalog. only each value is sent to the provider."
                        },
                        {
                            displayName: "Online Reviews Exist",
                            name: "online_reviews_exist",
                            type: "boolean",
                            default: false,
                            description: "Whether company has online reviews"
                        },
                        {
                            displayName: "Ownership Status",
                            name: "ownership_status",
                            type: "json",
                            default: [],
                            description: "Company ownership status"
                        },
                        {
                            displayName: "Pricing Available",
                            name: "pricing_available",
                            type: "boolean",
                            default: false,
                            description: "Whether company publishes pricing"
                        },
                        {
                            displayName: "Seniority Levels",
                            name: "seniority_levels",
                            type: "json",
                            default: [],
                            description: "Seniority level; use exact catalog values, e.g. c-level or president/vice president"
                        },
                        {
                            displayName: "Sic Codes",
                            name: "sic_codes",
                            type: "json",
                            default: [],
                            description: "Sic code objects from the catalog. only each value is sent to the provider."
                        },
                        {
                            displayName: "Technologies Used",
                            name: "technologies_used",
                            type: "json",
                            default: [],
                            description: "Technologies used by the company"
                        },
                        {
                            displayName: "Top Topics",
                            name: "top_topics",
                            type: "json",
                            default: [],
                            description: "Topics covered by the company website"
                        }
                    ],
                    required: true,
                    description: "Lead database filters to apply. use get /v1/lead-database/filters to see supported filters and values.",
                    displayOptions: {
                        show: {
                            resource: [
                                "leadDatabase"
                            ],
                            operation: [
                                "leadDatabase.startSearch"
                            ]
                        }
                    }
                },
                {
                    displayName: "Limit",
                    name: "limit",
                    type: "number",
                    default: 50,
                    required: true,
                    description: "Max number of results to return",
                    typeOptions: {
                        minValue: 1
                    },
                    displayOptions: {
                        show: {
                            resource: [
                                "leadDatabase"
                            ],
                            operation: [
                                "leadDatabase.startSearch"
                            ]
                        }
                    }
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Name to assign to the search",
                    displayOptions: {
                        show: {
                            resource: [
                                "leadDatabase"
                            ],
                            operation: [
                                "leadDatabase.startSearch"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "leadDatabase"
                            ],
                            operation: [
                                "leadDatabase.startSearch"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Webhook URL",
                            name: "webhook_url",
                            type: "string",
                            default: "",
                            description: "Public HTTPS URL that receives a notification when the search completes",
                            placeholder: "e.g. https://my-app.example.com/webhooks/sendpilot"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "leadExtractor"
                            ]
                        }
                    },
                    default: "leadExtractor.getResults",
                    options: [
                        {
                            name: "Create Lead Extractor Campaign",
                            value: "leadExtractor.startExtraction",
                            action: "Create lead extractor campaign",
                            description: "Launches a scraping job to extract and enrich leads from linkedin or sales navigator search URLs. lead extractor."
                        },
                        {
                            name: "Get Extractor Campaign Results",
                            value: "leadExtractor.getResults",
                            action: "Get extractor campaign results lead extractor",
                            description: "Retrieves paginated lead profiles, job history, and contact information from a finished extraction job. lead extractor."
                        },
                        {
                            name: "Get Extractor Campaign Status",
                            value: "leadExtractor.getStatus",
                            action: "Get extractor campaign status lead extractor",
                            description: "Retrieves the progress percentage and extraction status of a lead scraping campaign. lead extractor."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the lead extraction campaign",
                    displayOptions: {
                        show: {
                            resource: [
                                "leadExtractor"
                            ],
                            operation: [
                                "leadExtractor.getResults"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "leadExtractor"
                            ],
                            operation: [
                                "leadExtractor.getResults"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Enriched Only",
                            name: "enriched_only",
                            type: "boolean",
                            default: false,
                            description: "Whether when true, return only leads with completed enrichment. when omitted or false, return all leads. accepts true, false, 1, or 0."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Offset",
                            name: "offset",
                            type: "number",
                            default: 0,
                            description: "Number of leads to skip (starts at 0)",
                            typeOptions: {
                                minValue: 0,
                                maxValue: 10000
                            }
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the lead extraction campaign",
                    displayOptions: {
                        show: {
                            resource: [
                                "leadExtractor"
                            ],
                            operation: [
                                "leadExtractor.getStatus"
                            ]
                        }
                    }
                },
                {
                    displayName: "Limit",
                    name: "limit",
                    type: "number",
                    default: 50,
                    required: true,
                    description: "Max number of results to return",
                    typeOptions: {
                        minValue: 1
                    },
                    displayOptions: {
                        show: {
                            resource: [
                                "leadExtractor"
                            ],
                            operation: [
                                "leadExtractor.startExtraction"
                            ]
                        }
                    }
                },
                {
                    displayName: "Mode",
                    name: "mode",
                    type: "options",
                    default: "extraction_only",
                    required: true,
                    description: "Choose lead extraction only or extraction with enrichment",
                    options: [
                        {
                            name: "Extraction Only",
                            value: "extraction_only"
                        },
                        {
                            name: "With Enrichment",
                            value: "with_enrichment"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "leadExtractor"
                            ],
                            operation: [
                                "leadExtractor.startExtraction"
                            ]
                        }
                    }
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Name of the extraction campaign",
                    displayOptions: {
                        show: {
                            resource: [
                                "leadExtractor"
                            ],
                            operation: [
                                "leadExtractor.startExtraction"
                            ]
                        }
                    }
                },
                {
                    displayName: "URL Type",
                    name: "url_type",
                    type: "options",
                    default: "linkedin_search",
                    required: true,
                    description: "Type of the supplied search URLs",
                    options: [
                        {
                            name: "Linkedin Search",
                            value: "linkedin_search"
                        },
                        {
                            name: "Sales Navigator",
                            value: "sales_navigator"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "leadExtractor"
                            ],
                            operation: [
                                "leadExtractor.startExtraction"
                            ]
                        }
                    }
                },
                {
                    displayName: "URLs",
                    name: "urls",
                    type: "json",
                    default: [],
                    required: true,
                    description: "HTTPS search URLs from linkedin or sales navigator",
                    displayOptions: {
                        show: {
                            resource: [
                                "leadExtractor"
                            ],
                            operation: [
                                "leadExtractor.startExtraction"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "leadExtractor"
                            ],
                            operation: [
                                "leadExtractor.startExtraction"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Webhook URL",
                            name: "webhook_url",
                            type: "string",
                            default: "",
                            description: "Public HTTPS URL that receives a notification when the extraction campaign completes",
                            placeholder: "e.g. https://my-app.example.com/webhooks/sendpilot"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ]
                        }
                    },
                    default: "leads.add",
                    options: [
                        {
                            name: "Add Leads To Campaign",
                            value: "leads.add",
                            action: "Add leads to campaign",
                            description: "Adds one or more leads with profile attributes and custom fields to an outreach campaign"
                        },
                        {
                            name: "Get",
                            value: "leads.get",
                            action: "Get lead",
                            description: "Retrieves profile information, company data, and outreach history for a specific lead"
                        },
                        {
                            name: "Get Many",
                            value: "leads.list",
                            action: "Get many leads",
                            description: "Retrieves a paginated list of leads filtered by campaign ID and outreach progress status"
                        },
                        {
                            name: "Update Lead Status",
                            value: "leads.updateStatus",
                            action: "Update lead status",
                            description: "Updates the progression status and notes for a specific lead"
                        }
                    ]
                },
                {
                    displayName: "Campaign ID",
                    name: "campaignId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the campaign to add leads to",
                    placeholder: "e.g. cmobr5lei0000u1h02ezf5itt",
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ],
                            operation: [
                                "leads.add"
                            ]
                        }
                    }
                },
                {
                    displayName: "Leads",
                    name: "leads",
                    type: "json",
                    default: [],
                    required: true,
                    description: "Array of 1\u20131,000 leads. each lead must include linkedinurl; other fields are dynamic.",
                    placeholder: "e.g. [object Object]",
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ],
                            operation: [
                                "leads.add"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the lead to retrieve",
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ],
                            operation: [
                                "leads.get"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ],
                            operation: [
                                "leads.get"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Full",
                            name: "full",
                            type: "boolean",
                            default: false,
                            description: "Whether set to true (or 1) to include all fields: contact data, profile details, and custom fields"
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ],
                            operation: [
                                "leads.get"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "title",
                        "status",
                        "email",
                        "createdAt",
                        "updatedAt",
                        "about",
                        "campaignId",
                        "company",
                        "connectionCount"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ],
                            operation: [
                                "leads.get"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "About",
                            value: "about"
                        },
                        {
                            name: "CampaignId",
                            value: "campaignId"
                        },
                        {
                            name: "Company",
                            value: "company"
                        },
                        {
                            name: "ConnectionCount",
                            value: "connectionCount"
                        },
                        {
                            name: "CreatedAt",
                            value: "createdAt"
                        },
                        {
                            name: "CustomLeadStatus",
                            value: "customLeadStatus"
                        },
                        {
                            name: "Data",
                            value: "data"
                        },
                        {
                            name: "Email",
                            value: "email"
                        },
                        {
                            name: "FirstName",
                            value: "firstName"
                        },
                        {
                            name: "FollowerCount",
                            value: "followerCount"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "Industry",
                            value: "industry"
                        },
                        {
                            name: "IsOpenProfile",
                            value: "isOpenProfile"
                        },
                        {
                            name: "IsPremium",
                            value: "isPremium"
                        },
                        {
                            name: "LastName",
                            value: "lastName"
                        },
                        {
                            name: "LinkedinUrl",
                            value: "linkedinUrl"
                        },
                        {
                            name: "Location",
                            value: "location"
                        },
                        {
                            name: "ProfilePictureUrl",
                            value: "profilePictureUrl"
                        },
                        {
                            name: "SenderId",
                            value: "senderId"
                        },
                        {
                            name: "Status",
                            value: "status"
                        },
                        {
                            name: "Title",
                            value: "title"
                        },
                        {
                            name: "UpdatedAt",
                            value: "updatedAt"
                        },
                        {
                            name: "Website",
                            value: "website"
                        }
                    ]
                },
                {
                    displayName: "Campaign ID",
                    name: "campaignId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the campaign whose leads to return",
                    placeholder: "e.g. cmobr5lei0000u1h02ezf5itt",
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ],
                            operation: [
                                "leads.list"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ],
                            operation: [
                                "leads.list"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Full",
                            name: "full",
                            type: "boolean",
                            default: false,
                            description: "Whether when true, include all lead fields, including dynamic data. defaults to false.",
                            placeholder: "e.g. true"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "Page number to return (starts at 1)",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 100
                            }
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "options",
                            default: "PENDING",
                            description: "Filter leads by status",
                            options: [
                                {
                                    name: "BLOCKED",
                                    value: "BLOCKED"
                                },
                                {
                                    name: "CONNECTED",
                                    value: "CONNECTED"
                                },
                                {
                                    name: "CONNECTION ACCEPTED",
                                    value: "CONNECTION_ACCEPTED"
                                },
                                {
                                    name: "CONNECTION ALREADY SENT",
                                    value: "CONNECTION_ALREADY_SENT"
                                },
                                {
                                    name: "CONNECTION SCHEDULED",
                                    value: "CONNECTION_SCHEDULED"
                                },
                                {
                                    name: "CONNECTION SENT",
                                    value: "CONNECTION_SENT"
                                },
                                {
                                    name: "CONNECTION WITHDRAWN",
                                    value: "CONNECTION_WITHDRAWN"
                                },
                                {
                                    name: "DONE",
                                    value: "DONE"
                                },
                                {
                                    name: "FAILED",
                                    value: "FAILED"
                                },
                                {
                                    name: "FOLLOWUP SENT",
                                    value: "FOLLOWUP_SENT"
                                },
                                {
                                    name: "ICP MATCH",
                                    value: "ICP_MATCH"
                                },
                                {
                                    name: "ICP NOT MATCH",
                                    value: "ICP_NOT_MATCH"
                                },
                                {
                                    name: "IRRELEVANT",
                                    value: "IRRELEVANT"
                                },
                                {
                                    name: "LIKE POST SCHEDULED",
                                    value: "LIKE_POST_SCHEDULED"
                                },
                                {
                                    name: "LIKED POST",
                                    value: "LIKED_POST"
                                },
                                {
                                    name: "MEETING BOOKED",
                                    value: "MEETING_BOOKED"
                                },
                                {
                                    name: "MESSAGE SCHEDULED",
                                    value: "MESSAGE_SCHEDULED"
                                },
                                {
                                    name: "MESSAGE SENT",
                                    value: "MESSAGE_SENT"
                                },
                                {
                                    name: "NOT CONNECTED",
                                    value: "NOT_CONNECTED"
                                },
                                {
                                    name: "OPPORTUNITY",
                                    value: "OPPORTUNITY"
                                },
                                {
                                    name: "PENDING",
                                    value: "PENDING"
                                },
                                {
                                    name: "PROCESSING",
                                    value: "PROCESSING"
                                },
                                {
                                    name: "PROFILE UNREACHABLE",
                                    value: "PROFILE_UNREACHABLE"
                                },
                                {
                                    name: "PROFILE VIEWED",
                                    value: "PROFILE_VIEWED"
                                },
                                {
                                    name: "RATE LIMITED",
                                    value: "RATE_LIMITED"
                                },
                                {
                                    name: "REPLY RECEIVED",
                                    value: "REPLY_RECEIVED"
                                },
                                {
                                    name: "SKIPPED",
                                    value: "SKIPPED"
                                },
                                {
                                    name: "STARTED",
                                    value: "STARTED"
                                },
                                {
                                    name: "STOPPED",
                                    value: "STOPPED"
                                },
                                {
                                    name: "SUCCESS",
                                    value: "SUCCESS"
                                },
                                {
                                    name: "UNSUBSCRIBED",
                                    value: "UNSUBSCRIBED"
                                },
                                {
                                    name: "VIEW PROFILE SCHEDULED",
                                    value: "VIEW_PROFILE_SCHEDULED"
                                },
                                {
                                    name: "WAITING",
                                    value: "WAITING"
                                },
                                {
                                    name: "WITHDRAWAL NOT POSSIBLE",
                                    value: "WITHDRAWAL_NOT_POSSIBLE"
                                },
                                {
                                    name: "WITHDRAWAL SCHEDULED",
                                    value: "WITHDRAWAL_SCHEDULED"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the lead to update",
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ],
                            operation: [
                                "leads.updateStatus"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "leads"
                            ],
                            operation: [
                                "leads.updateStatus"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Custom Lead Status",
                            name: "customLeadStatus",
                            type: "options",
                            default: "LEAD",
                            description: "New custom lead status for CRM categorization",
                            placeholder: "e.g. INTERESTED",
                            options: [
                                {
                                    name: "CLOSED",
                                    value: "CLOSED"
                                },
                                {
                                    name: "INTERESTED",
                                    value: "INTERESTED"
                                },
                                {
                                    name: "LEAD",
                                    value: "LEAD"
                                },
                                {
                                    name: "MEETING BOOKED",
                                    value: "MEETING_BOOKED"
                                },
                                {
                                    name: "MEETING COMPLETE NOT CLOSED",
                                    value: "MEETING_COMPLETE_NOT_CLOSED"
                                },
                                {
                                    name: "NO RESPONSE",
                                    value: "NO_RESPONSE"
                                },
                                {
                                    name: "NOT INTERESTED",
                                    value: "NOT_INTERESTED"
                                },
                                {
                                    name: "WRONG PERSON",
                                    value: "WRONG_PERSON"
                                }
                            ]
                        },
                        {
                            displayName: "Note",
                            name: "note",
                            type: "string",
                            default: "",
                            description: "Optional note explaining the status change",
                            placeholder: "e.g. Customer showed interest in demo"
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "options",
                            default: "OPPORTUNITY",
                            description: "Set an outcome status. sequence-managed statuses cannot be changed through this field.",
                            placeholder: "e.g. MEETING_BOOKED",
                            options: [
                                {
                                    name: "DONE",
                                    value: "DONE"
                                },
                                {
                                    name: "IRRELEVANT",
                                    value: "IRRELEVANT"
                                },
                                {
                                    name: "MEETING BOOKED",
                                    value: "MEETING_BOOKED"
                                },
                                {
                                    name: "OPPORTUNITY",
                                    value: "OPPORTUNITY"
                                },
                                {
                                    name: "UNSUBSCRIBED",
                                    value: "UNSUBSCRIBED"
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const inputItems = this.getInputData();
        const output = [];
        for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
            const outputStart = output.length;
            let errorPlan = {};
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const nodeVersion = this.getNode().typeVersion;
                let additionalFields = {};
                const nodeOptions = this.getNodeParameter('options', itemIndex, {});
                let retryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
                let credentialApplications;
                let options;
                let pagination = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                let responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                switch (operation) {
                    case "campaigns.get": {
                        let path = "/v1/campaigns/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["connectionsSent", "createdAt", "id", "leadsContacted", "linkedInSenderIds", "messagesSent", "name", "repliesReceived", "status", "totalLeads", "type", "updatedAt"], simplified: ["id", "name", "status", "type", "createdAt", "updatedAt", "connectionsSent", "leadsContacted", "messagesSent", "repliesReceived"] };
                        errorPlan = { "404": { "title": "Campaign not found" } };
                        break;
                    }
                    case "campaigns.list": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/campaigns";
                        const qs = {};
                        const body = {};
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["campaigns", "pagination"], simplified: ["campaigns", "pagination"] };
                        errorPlan = { "401": { "title": "Invalid or missing API key" }, "429": { "title": "Rate limit exceeded" } };
                        break;
                    }
                    case "campaigns.update": {
                        let path = "/v1/campaigns/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        setBodyField(body, { "name": "action", "displayName": "Action", "description": "Pause or resume the campaign.", "type": "string", "required": true, "enum": ["pause", "resume"], "example": "pause" }, this.getNodeParameter("action", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["action", "campaignId", "message", "newStatus", "success"], simplified: ["action", "campaignId", "message", "newStatus", "success"] };
                        errorPlan = { "400": { "title": "Invalid action or campaign state" }, "404": { "title": "Campaign not found" } };
                        break;
                    }
                    case "credits.get": {
                        const path = "/v1/credits";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["available", "nextResetDate", "purchased", "subscription", "used"], simplified: ["available", "nextResetDate", "purchased", "subscription", "used"] };
                        errorPlan = { "401": { "title": "Invalid or missing API key" }, "404": { "title": "Workspace not found" }, "429": { "title": "Rate limit exceeded" }, "500": { "title": "Internal server error" } };
                        break;
                    }
                    case "leadDatabase.filters": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/lead-database/filters";
                        const qs = {};
                        const body = {};
                        if (additionalFields["filter"] !== undefined)
                            qs["filter"] = additionalFields["filter"];
                        if (additionalFields["search"] !== undefined)
                            qs["search"] = additionalFields["search"];
                        if (additionalFields["offset"] !== undefined)
                            qs["offset"] = additionalFields["offset"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["filter", "filters", "has_more", "limit", "offset", "total", "values"], simplified: ["filter", "filters", "has_more", "limit", "offset", "total", "values"] };
                        errorPlan = { "400": { "title": "Unsupported filter or invalid pagination" }, "401": { "title": "Invalid or missing API key" }, "403": { "title": "Key lacks leads:read" } };
                        break;
                    }
                    case "senders.quotas": {
                        const path = "/v1/senders/quotas";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["senders", "total"], simplified: ["senders", "total"] };
                        errorPlan = { "401": { "title": "Invalid or missing API key" }, "403": { "title": "Key lacks senders:read" } };
                        break;
                    }
                    case "workspace.me": {
                        const path = "/v1/me";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["apiKey", "missingScopes", "subscription", "workspace"], simplified: ["apiKey", "missingScopes", "subscription", "workspace"] };
                        errorPlan = { "401": { "title": "Invalid or missing API key" }, "403": { "title": "Key lacks workspace:read" } };
                        break;
                    }
                    case "inbox.listConversations": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/inbox/conversations";
                        const qs = {};
                        const body = {};
                        if (additionalFields["accountId"] !== undefined)
                            qs["accountId"] = additionalFields["accountId"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["continuationToken"] !== undefined)
                            qs["continuationToken"] = additionalFields["continuationToken"];
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["conversations", "pagination"], simplified: ["conversations", "pagination"] };
                        errorPlan = { "404": { "title": "Account not found" } };
                        break;
                    }
                    case "inbox.listMessages": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/inbox/conversations/{conversationId}/messages";
                        const qs = {};
                        const body = {};
                        path = path.split("{conversationId}").join(encodeURIComponent(String(this.getNodeParameter("conversationId", itemIndex))));
                        qs["accountId"] = this.getNodeParameter("accountId", itemIndex);
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["continuationToken"] !== undefined)
                            qs["continuationToken"] = additionalFields["continuationToken"];
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["conversationId", "messages", "pagination"], simplified: ["conversationId", "messages", "pagination"] };
                        errorPlan = { "400": { "title": "Missing accountId parameter" }, "404": { "title": "Conversation or account not found" } };
                        break;
                    }
                    case "inbox.listSenders": {
                        const path = "/v1/inbox/senders";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["senders", "total"], simplified: ["senders", "total"] };
                        errorPlan = {};
                        break;
                    }
                    case "inbox.sendConnectionRequest": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/inbox/connect";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["message"] !== undefined)
                            setBodyField(body, { "name": "message", "displayName": "Message", "description": "Optional connection note, available only for premium LinkedIn accounts.", "type": "string", "example": "Hi John, I would love to connect with you!" }, additionalFields["message"], this, itemIndex);
                        setBodyField(body, { "name": "recipientLinkedinUrl", "displayName": "Recipient Linkedin Url", "description": "LinkedIn profile URL of the person to connect with.", "type": "string", "required": true, "example": "https://www.linkedin.com/in/johndoe/" }, this.getNodeParameter("recipientLinkedinUrl", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "senderId", "displayName": "Sender Id", "description": "ID of the connected LinkedIn sender account to use.", "type": "string", "required": true, "example": "sender_123" }, this.getNodeParameter("senderId", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["error", "recipientLinkedinUrl", "requestId", "status", "success", "timestamp"], simplified: ["error", "recipientLinkedinUrl", "requestId", "status", "success", "timestamp"] };
                        errorPlan = { "400": { "title": "Invalid request or sender not found" }, "429": { "title": "Daily connection limit exceeded" } };
                        break;
                    }
                    case "inbox.sendMessage": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/inbox/send";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["campaignId"] !== undefined)
                            setBodyField(body, { "name": "campaignId", "displayName": "Campaign Id", "description": "Optional campaign ID to associate this message with", "type": "string", "example": "campaign_123" }, additionalFields["campaignId"], this, itemIndex);
                        if (additionalFields["leadId"] !== undefined)
                            setBodyField(body, { "name": "leadId", "displayName": "Lead Id", "description": "Optional lead ID to associate this message with", "type": "string", "example": "lead_123" }, additionalFields["leadId"], this, itemIndex);
                        setBodyField(body, { "name": "message", "displayName": "Message", "description": "Text of the LinkedIn message to send.", "type": "string", "required": true, "example": "Hi John, I wanted to follow up on our conversation..." }, this.getNodeParameter("message", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "recipientLinkedinUrl", "displayName": "Recipient Linkedin Url", "description": "LinkedIn profile URL of the recipient. The recipient must be a first-degree connection of the sender.", "type": "string", "required": true, "example": "https://www.linkedin.com/in/johndoe/" }, this.getNodeParameter("recipientLinkedinUrl", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "senderId", "displayName": "Sender Id", "description": "ID of the connected LinkedIn sender account to use.", "type": "string", "required": true, "example": "sender_123" }, this.getNodeParameter("senderId", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["conversationId", "error", "leadId", "messageId", "recipientLinkedinUrl", "status", "success", "timestamp"], simplified: ["conversationId", "error", "leadId", "messageId", "recipientLinkedinUrl", "status", "success", "timestamp"] };
                        errorPlan = { "400": { "title": "Invalid request or sender not found" }, "429": { "title": "Daily message limit exceeded" } };
                        break;
                    }
                    case "inbox.sendMessageToLead": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/inbox/send/lead/{leadId}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{leadId}").join(encodeURIComponent(String(this.getNodeParameter("leadId", itemIndex))));
                        if (additionalFields["campaignId"] !== undefined)
                            setBodyField(body, { "name": "campaignId", "displayName": "Campaign Id", "description": "Optional campaign ID to associate this message with", "type": "string" }, additionalFields["campaignId"], this, itemIndex);
                        setBodyField(body, { "name": "message", "displayName": "Message", "description": "Message content to send", "type": "string", "required": true, "example": "Hi {{firstName}}, I wanted to follow up on our conversation..." }, this.getNodeParameter("message", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "senderId", "displayName": "Sender Id", "description": "LinkedIn sender ID to use", "type": "string", "required": true, "example": "sender_123" }, this.getNodeParameter("senderId", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["conversationId", "error", "leadId", "messageId", "recipientLinkedinUrl", "status", "success", "timestamp"], simplified: ["conversationId", "error", "leadId", "messageId", "recipientLinkedinUrl", "status", "success", "timestamp"] };
                        errorPlan = { "400": { "title": "Invalid request or sender not found" }, "404": { "title": "Lead not found" } };
                        break;
                    }
                    case "leadDatabase.getSearchResults": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/lead-database/searches/{id}/results";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["offset"] !== undefined)
                            qs["offset"] = additionalFields["offset"];
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["has_more", "leads", "limit", "offset", "search_id", "total"], simplified: ["has_more", "leads", "limit", "offset", "search_id", "total"] };
                        errorPlan = { "401": { "title": "Invalid or missing API key" }, "404": { "title": "Search not found" }, "429": { "title": "Rate limit exceeded" } };
                        break;
                    }
                    case "leadDatabase.getSearchStatus": {
                        let path = "/v1/lead-database/searches/{id}/status";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["completed_at", "created_at", "error_message", "id", "name", "progress", "status"], simplified: ["completed_at", "created_at", "error_message", "id", "name", "progress", "status"] };
                        errorPlan = { "401": { "title": "Invalid or missing API key" }, "404": { "title": "Search not found" }, "429": { "title": "Rate limit exceeded" } };
                        break;
                    }
                    case "leadDatabase.startSearch": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/lead-database/searches";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        setBodyField(body, { "name": "filters", "displayName": "Filters", "description": "Lead database filters to apply. Use GET /v1/lead-database/filters to see supported filters and values.", "type": "object", "required": true, "representation": "raw", "fields": [{ "name": "acquired_end_date", "displayName": "Acquired end date", "description": "Acquisition date range end, dd/mm/yyyy.", "type": "string" }, { "name": "acquired_start_date", "displayName": "Acquired start date", "description": "Acquisition date range start, dd/mm/yyyy.", "type": "string" }, { "name": "bulk_domains", "displayName": "Bulk domains", "description": "Company domains separated by commas or newlines.", "type": "string" }, { "name": "companies", "displayName": "Companies", "description": "Company names.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "company_linkedin_username", "displayName": "Company linkedin username", "description": "Company LinkedIn usernames or URLs.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "company_sizes", "displayName": "Company sizes", "description": "Employee-size ranges.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "enum": ["1", "2-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"] } }, { "name": "company_type", "displayName": "Company type", "description": "Company types.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "enum": ["Privately Held", "Public Company", "Self-Owned", "Partnership", "Self-Employed", "Nonprofit", "Educational", "Government Agency"] } }, { "name": "demo_available", "displayName": "Demo available", "description": "Company offers a demo.", "type": "boolean" }, { "name": "documentation_exist", "displayName": "Documentation exist", "description": "Company provides documentation.", "type": "boolean" }, { "name": "excluded_bulk_domains", "displayName": "Excluded bulk domains", "description": "Company domains to exclude, separated by commas or newlines.", "type": "string" }, { "name": "excluded_companies", "displayName": "Excluded companies", "description": "Company names to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_company_linkedin_username", "displayName": "Excluded company linkedin username", "description": "Company LinkedIn usernames or URLs to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_company_sizes", "displayName": "Excluded company sizes", "description": "Employee-size codes to exclude, from 1 (one employee) to 9 (10001+).", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "integer", "enum": [1, 2, 3, 4, 5, 6, 7, 8, 9] } }, { "name": "excluded_company_type", "displayName": "Excluded company type", "description": "Company types to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "enum": ["Privately Held", "Public Company", "Self-Owned", "Partnership", "Self-Employed", "Nonprofit", "Educational", "Government Agency"] } }, { "name": "excluded_experimental_department", "displayName": "Excluded experimental department", "description": "Compatibility alias for excluded_member_department; do not supply both with different values.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_experimental_industries", "displayName": "Excluded experimental industries", "description": "Compatibility alias for excluded_industries; do not supply both with different values.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_hq_location", "displayName": "Excluded hq location", "description": "Headquarters locations to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_industries", "displayName": "Excluded industries", "description": "Industries to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_job_posting_functions", "displayName": "Excluded job posting functions", "description": "Job functions to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_job_posting_location", "displayName": "Excluded job posting location", "description": "Job posting locations to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_job_posting_title", "displayName": "Excluded job posting title", "description": "Recruiting titles to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_job_titles", "displayName": "Excluded job titles", "description": "Job titles to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_keywords", "displayName": "Excluded keywords", "description": "Company keywords to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_locations", "displayName": "Excluded locations", "description": "Person locations to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_member_certifications", "displayName": "Excluded member certifications", "description": "Certifications to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_member_department", "displayName": "Excluded member department", "description": "Departments to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_member_description", "displayName": "Excluded member description", "description": "Profile-summary keywords to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_member_linkedin_username", "displayName": "Excluded member linkedin username", "description": "LinkedIn usernames or profile URLs to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_member_skills", "displayName": "Excluded member skills", "description": "Profile skills to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_naics_codes", "displayName": "Excluded naics codes", "description": "NAICS code strings to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_seniority_levels", "displayName": "Excluded seniority levels", "description": "Seniority levels to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "enum": ["Specialist", "Manager", "Owner", "Founder", "President/Vice President", "Director", "Senior", "Head", "C-Level", "Partner", "Intern"] } }, { "name": "excluded_sic_codes", "displayName": "Excluded sic codes", "description": "SIC code strings to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_technologies_used", "displayName": "Excluded technologies used", "description": "Company technologies to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "excluded_top_topics", "displayName": "Excluded top topics", "description": "Website topics to exclude.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "experimental_industries", "displayName": "Experimental industries", "description": "Compatibility alias for industries; do not supply both with different values.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "experimental_member_department", "displayName": "Experimental member department", "description": "Compatibility alias for member_department; do not supply both with different values.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "free_trial_available", "displayName": "Free trial available", "description": "Company offers a free trial.", "type": "boolean" }, { "name": "hq_location", "displayName": "Hq location", "description": "Company headquarters locations.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "industries", "displayName": "Industries", "description": "Company industries. Uses the supported experimental_industries provider field; query the catalog for values.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "ipo_end_date", "displayName": "Ipo end date", "description": "IPO date range end, dd/mm/yyyy.", "type": "string" }, { "name": "ipo_start_date", "displayName": "Ipo start date", "description": "IPO date range start, dd/mm/yyyy.", "type": "string" }, { "name": "is_downloadable", "displayName": "Is downloadable", "description": "Company offers downloadable software/resources.", "type": "boolean" }, { "name": "is_mapped_industries_strict", "displayName": "Is mapped industries strict", "description": "True requires exact industry matching; false lets the provider match related industries.", "type": "boolean" }, { "name": "job_posting_end_date", "displayName": "Job posting end date", "description": "Job posting date range end, dd/mm/yyyy.", "type": "string" }, { "name": "job_posting_location", "displayName": "Job posting location", "description": "Job posting locations.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "job_posting_seniority", "displayName": "Job posting seniority", "description": "Recruiting seniority levels.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "enum": ["Entry level", "Internship", "Associate", "Mid-Senior level", "Director", "Executive", "Not Applicable"] } }, { "name": "job_posting_start_date", "displayName": "Job posting start date", "description": "Job posting date range start, dd/mm/yyyy.", "type": "string" }, { "name": "job_posting_title", "displayName": "Job posting title", "description": "Job titles the company is recruiting.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "job_posting_type", "displayName": "Job posting type", "description": "Employment types.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "enum": ["Full-time", "Part-time", "Contract", "Internship", "Volunteer", "Temporary", "Other"] } }, { "name": "job_title_match_mode", "displayName": "Job title match mode", "description": "Job-title matching: exact, contains (provider default), or smart.", "type": "string", "enum": ["exact", "contains", "smart"] }, { "name": "job_title_smart_mode", "displayName": "Job title smart mode", "description": "Sensitivity when job_title_match_mode is smart.", "type": "string", "enum": ["loose", "normal", "strict"] }, { "name": "job_titles", "displayName": "Job titles", "description": "Current job titles. Use the filter catalog for suggested values.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "keywords", "displayName": "Keywords", "description": "Keywords in company descriptions or specialties.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "last_funding_round_name", "displayName": "Last funding round name", "description": "Latest funding-round types.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "enum": ["Seed Round", "Pre Seed Round", "Venture Round", "Series A", "Grant", "Non Equity Assistance", "Private Equity Round", "Series B", "Angel Round", "Debt Financing", "Post-IPO Equity", "Series C", "Corporate Round", "Equity Crowdfunding", "Funding Round", "Convertible Note", "Post-IPO Debt", "Series D", "Secondary Market", "Post-IPO Secondary", "Initial Coin Offering", "Product Crowdfunding", "Series E", "Series F", "Series G", "Series H"] } }, { "name": "locations", "displayName": "Locations", "description": "Person country, region or city.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "max_average_visit_duration_seconds", "displayName": "Max average visit duration seconds", "description": "Maximum visit duration in seconds.", "type": "integer", "minValue": 0 }, { "name": "max_bounce_rate", "displayName": "Max bounce rate", "description": "Maximum bounce-rate percentage.", "type": "integer", "minValue": 0, "maxValue": 100 }, { "name": "max_company_employee_reviews_aggregate_score", "displayName": "Max company employee reviews aggregate score", "description": "Maximum employee-review score.", "type": "integer", "minValue": 0 }, { "name": "max_job_duration_months", "displayName": "Max job duration months", "description": "Maximum time in the current job, in months.", "type": "integer", "minValue": 0 }, { "name": "max_last_funding_round_amount_raised", "displayName": "Max last funding round amount raised", "description": "Maximum latest funding amount.", "type": "integer", "minValue": 0 }, { "name": "max_pages_per_visit", "displayName": "Max pages per visit", "description": "Maximum average pages per visit.", "type": "integer", "minValue": 0 }, { "name": "max_rank_category", "displayName": "Max rank category", "description": "Maximum website rank within its category.", "type": "integer", "minValue": 0 }, { "name": "max_rank_country", "displayName": "Max rank country", "description": "Maximum website rank within its country.", "type": "integer", "minValue": 0 }, { "name": "max_rank_global", "displayName": "Max rank global", "description": "Maximum global website rank.", "type": "integer", "minValue": 0 }, { "name": "max_revenue_annual", "displayName": "Max revenue annual", "description": "Maximum annual revenue.", "type": "integer", "minValue": 0 }, { "name": "max_total_experience_duration_months", "displayName": "Max total experience duration months", "description": "Maximum total experience in months.", "type": "integer", "minValue": 0 }, { "name": "max_total_website_visits_monthly", "displayName": "Max total website visits monthly", "description": "Maximum monthly website visits.", "type": "integer", "minValue": 0 }, { "name": "member_certifications", "displayName": "Member certifications", "description": "Professional certifications.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "member_department", "displayName": "Member department", "description": "Departments; mapped to the supported provider department filter.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "member_description", "displayName": "Member description", "description": "Keywords in profile summaries.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "member_full_name", "displayName": "Member full name", "description": "Person name search.", "type": "string" }, { "name": "member_linkedin_username", "displayName": "Member linkedin username", "description": "LinkedIn usernames or profile URLs.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "member_skills", "displayName": "Member skills", "description": "Profile skills.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "min_average_visit_duration_seconds", "displayName": "Min average visit duration seconds", "description": "Minimum visit duration in seconds.", "type": "integer", "minValue": 0 }, { "name": "min_bounce_rate", "displayName": "Min bounce rate", "description": "Minimum bounce-rate percentage.", "type": "integer", "minValue": 0, "maxValue": 100 }, { "name": "min_company_employee_reviews_aggregate_score", "displayName": "Min company employee reviews aggregate score", "description": "Minimum employee-review score.", "type": "integer", "minValue": 0 }, { "name": "min_job_duration_months", "displayName": "Min job duration months", "description": "Minimum time in the current job, in months.", "type": "integer", "minValue": 0 }, { "name": "min_last_funding_round_amount_raised", "displayName": "Min last funding round amount raised", "description": "Minimum latest funding amount.", "type": "integer", "minValue": 0 }, { "name": "min_pages_per_visit", "displayName": "Min pages per visit", "description": "Minimum average pages per visit.", "type": "integer", "minValue": 0 }, { "name": "min_rank_category", "displayName": "Min rank category", "description": "Minimum website rank within its category.", "type": "integer", "minValue": 0 }, { "name": "min_rank_country", "displayName": "Min rank country", "description": "Minimum website rank within its country.", "type": "integer", "minValue": 0 }, { "name": "min_rank_global", "displayName": "Min rank global", "description": "Minimum global website rank.", "type": "integer", "minValue": 0 }, { "name": "min_revenue_annual", "displayName": "Min revenue annual", "description": "Minimum annual revenue.", "type": "integer", "minValue": 0 }, { "name": "min_total_experience_duration_months", "displayName": "Min total experience duration months", "description": "Minimum total experience in months.", "type": "integer", "minValue": 0 }, { "name": "min_total_website_visits_monthly", "displayName": "Min total website visits monthly", "description": "Minimum monthly website visits.", "type": "integer", "minValue": 0 }, { "name": "mobile_apps_exist", "displayName": "Mobile apps exist", "description": "Company has mobile apps.", "type": "boolean" }, { "name": "naics_codes", "displayName": "Naics codes", "description": "NAICS code objects from the catalog. Only each value is sent to the provider.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "label", "displayName": "Label", "type": "string", "required": true }, { "name": "value", "displayName": "Value", "type": "string", "required": true }] } }, { "name": "online_reviews_exist", "displayName": "Online reviews exist", "description": "Company has online reviews.", "type": "boolean" }, { "name": "ownership_status", "displayName": "Ownership status", "description": "Company ownership status.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "enum": ["Private", "Public", "Investment Company", "NGO/NPO/NFP/Organization/Association", "Government", "Product/Brand/Service", "SPAC"] } }, { "name": "pricing_available", "displayName": "Pricing available", "description": "Company publishes pricing.", "type": "boolean" }, { "name": "seniority_levels", "displayName": "Seniority levels", "description": "Seniority level; use exact catalog values, e.g. C-Level or President/Vice President.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "enum": ["Specialist", "Manager", "Owner", "Founder", "President/Vice President", "Director", "Senior", "Head", "C-Level", "Partner", "Intern"] } }, { "name": "sic_codes", "displayName": "Sic codes", "description": "SIC code objects from the catalog. Only each value is sent to the provider.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "label", "displayName": "Label", "type": "string", "required": true }, { "name": "value", "displayName": "Value", "type": "string", "required": true }] } }, { "name": "technologies_used", "displayName": "Technologies used", "description": "Technologies used by the company.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "top_topics", "displayName": "Top topics", "description": "Topics covered by the company website.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, this.getNodeParameter("filters", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "limit", "displayName": "Limit", "description": "Maximum number of leads to find. Available credits cap the number returned; there is no fixed maximum.", "type": "number", "required": true, "minValue": 1 }, this.getNodeParameter("limit", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "description": "Name to assign to the search.", "type": "string", "required": true }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        if (additionalFields["webhook_url"] !== undefined)
                            setBodyField(body, { "name": "webhook_url", "displayName": "Webhook url", "description": "Public HTTPS URL that receives a notification when the search completes.", "type": "string", "example": "https://my-app.example.com/webhooks/sendpilot" }, additionalFields["webhook_url"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_at", "estimated_quota", "id", "name", "status"], simplified: ["created_at", "estimated_quota", "id", "name", "status"] };
                        errorPlan = { "401": { "title": "Invalid or missing API key" }, "403": { "title": "Insufficient quota" }, "429": { "title": "Rate limit exceeded" }, "500": { "title": "Internal server error" } };
                        break;
                    }
                    case "leadExtractor.getResults": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/lead-extractor/campaigns/{id}/results";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["offset"] !== undefined)
                            qs["offset"] = additionalFields["offset"];
                        if (additionalFields["enriched_only"] !== undefined)
                            qs["enriched_only"] = additionalFields["enriched_only"];
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["campaign_id", "has_more", "leads", "limit", "offset", "total"], simplified: ["campaign_id", "has_more", "leads", "limit", "offset", "total"] };
                        errorPlan = { "401": { "title": "Invalid or missing API key" }, "404": { "title": "Campaign not found" }, "429": { "title": "Rate limit exceeded" } };
                        break;
                    }
                    case "leadExtractor.getStatus": {
                        let path = "/v1/lead-extractor/campaigns/{id}/status";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["completed_at", "created_at", "error_message", "id", "name", "progress", "status"], simplified: ["completed_at", "created_at", "error_message", "id", "name", "progress", "status"] };
                        errorPlan = { "401": { "title": "Invalid or missing API key" }, "404": { "title": "Campaign not found" }, "429": { "title": "Rate limit exceeded" } };
                        break;
                    }
                    case "leadExtractor.startExtraction": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/lead-extractor/campaigns";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        setBodyField(body, { "name": "limit", "displayName": "Limit", "description": "Maximum number of leads to extract. Available credits cap the number returned; there is no fixed maximum.", "type": "number", "required": true, "minValue": 1 }, this.getNodeParameter("limit", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "mode", "displayName": "Mode", "description": "Choose lead extraction only or extraction with enrichment.", "type": "string", "required": true, "enum": ["extraction_only", "with_enrichment"] }, this.getNodeParameter("mode", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "description": "Name of the extraction campaign.", "type": "string", "required": true }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "url_type", "displayName": "Url type", "description": "Type of the supplied search URLs.", "type": "string", "required": true, "enum": ["linkedin_search", "sales_navigator"] }, this.getNodeParameter("url_type", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "urls", "displayName": "Urls", "description": "HTTPS search URLs from LinkedIn or Sales Navigator.", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, this.getNodeParameter("urls", itemIndex), this, itemIndex);
                        if (additionalFields["webhook_url"] !== undefined)
                            setBodyField(body, { "name": "webhook_url", "displayName": "Webhook url", "description": "Public HTTPS URL that receives a notification when the extraction campaign completes.", "type": "string", "example": "https://my-app.example.com/webhooks/sendpilot" }, additionalFields["webhook_url"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_at", "estimated_credits", "id", "name", "status"], simplified: ["created_at", "estimated_credits", "id", "name", "status"] };
                        errorPlan = { "400": { "title": "Invalid request parameters" }, "401": { "title": "Invalid or missing API key" }, "403": { "title": "Insufficient credits" }, "429": { "title": "Rate limit exceeded" } };
                        break;
                    }
                    case "leads.add": {
                        const path = "/v1/leads";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        setBodyField(body, { "name": "campaignId", "displayName": "Campaign Id", "description": "ID of the campaign to add leads to.", "type": "string", "required": true, "example": "cmobr5lei0000u1h02ezf5itt" }, this.getNodeParameter("campaignId", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "leads", "displayName": "Leads", "description": "Array of 1–1,000 leads. Each lead must include linkedinUrl; other fields are dynamic.", "type": "array", "required": true, "example": [{ "company": "Acme Corp", "firstName": "John", "industry": "SaaS", "lastName": "Doe", "linkedinUrl": "https://www.linkedin.com/in/johndoe/", "region": "EMEA", "title": "VP of Engineering" }], "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "company", "displayName": "Company", "type": "string", "example": "Acme Corp" }, { "name": "email", "displayName": "Email", "type": "string", "example": "john@example.com" }, { "name": "firstName", "displayName": "First Name", "type": "string", "example": "John" }, { "name": "lastName", "displayName": "Last Name", "type": "string", "example": "Doe" }, { "name": "linkedinUrl", "displayName": "Linkedin Url", "type": "string", "required": true, "example": "https://www.linkedin.com/in/johndoe/" }, { "name": "title", "displayName": "Title", "type": "string", "example": "VP of Engineering" }], "additionalValue": { "name": "value", "displayName": "Value", "type": "any" } } }, this.getNodeParameter("leads", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["duplicatesSkipped", "errors", "invalidEntries", "leadsAdded", "success"], simplified: ["duplicatesSkipped", "errors", "invalidEntries", "leadsAdded", "success"] };
                        errorPlan = { "400": { "title": "Invalid request data" }, "404": { "title": "Campaign not found" } };
                        break;
                    }
                    case "leads.get": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/leads/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["full"] !== undefined)
                            qs["full"] = additionalFields["full"];
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["about", "campaignId", "company", "connectionCount", "createdAt", "customLeadStatus", "data", "email", "firstName", "followerCount", "id", "industry", "isOpenProfile", "isPremium", "lastName", "linkedinUrl", "location", "profilePictureUrl", "senderId", "status", "title", "updatedAt", "website"], simplified: ["id", "title", "status", "email", "createdAt", "updatedAt", "about", "campaignId", "company", "connectionCount"] };
                        errorPlan = { "404": { "title": "Lead not found" } };
                        break;
                    }
                    case "leads.list": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/leads";
                        const qs = {};
                        const body = {};
                        qs["campaignId"] = this.getNodeParameter("campaignId", itemIndex);
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["full"] !== undefined)
                            qs["full"] = additionalFields["full"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["leads", "pagination"], simplified: ["leads", "pagination"] };
                        errorPlan = {};
                        break;
                    }
                    case "leads.updateStatus": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/leads/{id}/status";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["customLeadStatus"] !== undefined)
                            setBodyField(body, { "name": "customLeadStatus", "displayName": "Custom Lead Status", "description": "New custom lead status for CRM categorization", "type": "string", "enum": ["LEAD", "INTERESTED", "MEETING_BOOKED", "MEETING_COMPLETE_NOT_CLOSED", "CLOSED", "WRONG_PERSON", "NOT_INTERESTED", "NO_RESPONSE"], "example": "INTERESTED" }, additionalFields["customLeadStatus"], this, itemIndex);
                        if (additionalFields["note"] !== undefined)
                            setBodyField(body, { "name": "note", "displayName": "Note", "description": "Optional note explaining the status change.", "type": "string", "example": "Customer showed interest in demo" }, additionalFields["note"], this, itemIndex);
                        if (additionalFields["status"] !== undefined)
                            setBodyField(body, { "name": "status", "displayName": "Status", "description": "Set an outcome status. Sequence-managed statuses cannot be changed through this field.", "type": "string", "enum": ["OPPORTUNITY", "MEETING_BOOKED", "DONE", "UNSUBSCRIBED", "IRRELEVANT"], "example": "MEETING_BOOKED" }, additionalFields["status"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.sendpilot.ai", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "sendpilotApi", "type": "apiKey", "location": "header", "parameter": "X-API-Key" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["leadId", "message", "status", "success"], simplified: ["leadId", "message", "status", "success"] };
                        errorPlan = { "400": { "title": "At least one of status or customLeadStatus is required" }, "404": { "title": "Lead not found" } };
                        break;
                    }
                    default: throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
                }
                const returnAll = pagination.style !== 'none' ? Boolean((_a = nodeOptions.returnAll) !== null && _a !== void 0 ? _a : false) : false;
                const resultLimit = pagination.style !== 'none' && !returnAll ? Number((_b = nodeOptions.resultLimit) !== null && _b !== void 0 ? _b : 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
                const pageStartTime = Date.now();
                const seenCursors = new Map();
                const seenPages = new Map();
                let page = 1;
                let offset = 0;
                let cursor;
                let pagesFetched = 0;
                let estimatedBytes = 0;
                let finished = false;
                while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
                    if (Date.now() - pageStartTime > pagination.maxElapsedMs)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
                    const qs = options.qs;
                    if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined))
                        qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
                    if (pagination.style === 'offset' && pagination.page)
                        qs[pagination.page] = offset;
                    if (pagination.style === 'pageNumber' && pagination.page)
                        qs[pagination.page] = page;
                    if (pagination.style === 'cursor' && pagination.cursor && cursor)
                        qs[pagination.cursor] = cursor;
                    const response = await (0, http_1.requestWithRetry)(this, options, credentialApplications, retryContract, itemIndex);
                    pagesFetched += 1;
                    const pageFingerprint = JSON.stringify(response);
                    const pageRepeats = ((_c = seenPages.get(pageFingerprint)) !== null && _c !== void 0 ? _c : 0) + 1;
                    seenPages.set(pageFingerprint, pageRepeats);
                    if (pageRepeats > pagination.repeatedPageLimit)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
                    estimatedBytes += pageFingerprint.length;
                    if (estimatedBytes > pagination.maxMemoryBytes)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
                    if (responsePlan.binary) {
                        const binaryPayload = responsePlan.full ? ((_d = response.body) !== null && _d !== void 0 ? _d : response) : response;
                        const responseHeaders = (_e = (responsePlan.full ? response.headers : undefined)) !== null && _e !== void 0 ? _e : {};
                        const contentType = String((_f = responseHeaders['content-type']) !== null && _f !== void 0 ? _f : '').split(';')[0].trim() || 'application/octet-stream';
                        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload), undefined, contentType);
                        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
                        finished = true;
                        continue;
                    }
                    const normalizedResponse = responsePlan.full ? ((_g = response.body) !== null && _g !== void 0 ? _g : response) : response;
                    const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
                    if (responsePlan.envelopePath && envelopeValue === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
                    const envelope = (envelopeValue !== null && envelopeValue !== void 0 ? envelopeValue : normalizedResponse);
                    const itemPath = pagination.itemPath || responsePlan.itemPath;
                    const extractedItems = valueAtPath(envelope, itemPath);
                    if (itemPath && extractedItems === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
                    const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
                        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse).length === 0));
                    const values = deletedFallback
                        ? [{ deleted: true }]
                        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems !== null && extractedItems !== void 0 ? extractedItems : envelope];
                    const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') : 'raw';
                    const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) : [];
                    for (const value of values) {
                        if (output.length - outputStart >= resultLimit)
                            break;
                        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
                        output.push({ json: selectResponseFields(value, fields), pairedItem: { item: itemIndex } });
                    }
                    if (!returnAll || pagination.style === 'none' || values.length === 0) {
                        finished = true;
                        continue;
                    }
                    if (pagination.hasMore && envelope[pagination.hasMore] === false) {
                        finished = true;
                        continue;
                    }
                    if (pagination.style === 'cursor') {
                        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
                        finished = !cursor;
                        if (cursor) {
                            const key = String(cursor);
                            const repeats = ((_h = seenCursors.get(key)) !== null && _h !== void 0 ? _h : 0) + 1;
                            seenCursors.set(key, repeats);
                            if (repeats > pagination.repeatedCursorLimit)
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
                        }
                    }
                    if (pagination.advancement === 'offsetByItems')
                        offset += values.length;
                    if (pagination.advancement === 'incrementPage')
                        page += 1;
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    output.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeApiError) {
                    const status = String((_l = (_j = error.httpCode) !== null && _j !== void 0 ? _j : (_k = error.cause) === null || _k === void 0 ? void 0 : _k.statusCode) !== null && _l !== void 0 ? _l : 'default');
                    const planned = (_m = errorPlan[status]) !== null && _m !== void 0 ? _m : errorPlan.default;
                    if (planned) {
                        const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
                        const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex, message: planned.title, description });
                    }
                }
                if (error instanceof n8n_workflow_1.NodeApiError)
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [output];
    }
}
exports.Sendpilot = Sendpilot;
//# sourceMappingURL=Sendpilot.node.js.map