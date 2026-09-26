import { NodeConnectionTypes, NodeApiError, NodeOperationError, type IDataObject, type IExecuteFunctions, type IHttpRequestOptions, type INodeExecutionData, type INodeType, type INodeTypeDescription, type JsonObject } from "n8n-workflow";
import { requestWithRetry, resolveServerBaseUrl } from "../../shared/http";

// Generated with ts-morph
type CredentialApplication = { credentialType: string; type: 'apiKey' | 'basic' | 'bearer' | 'oauth2' | 'custom'; location?: 'header' | 'query'; parameter?: string; injections?: Array<{ target: 'header' | 'query' | 'body'; name: string; value: string }> };
type RetryContract = { mode: string; retryConnectionFailures?: boolean; retryTimeouts?: boolean; retryRateLimits?: boolean; retryServerErrors?: boolean; maxAttempts: number; maxElapsedMs: number; baseBackoffMs: number; maxBackoffMs: number; jitterRatio: number; idempotency?: { target: 'header' | 'query' | 'body'; parameter: string } };
type PaginationContract = { style: string; page?: string; limit?: string; cursor?: string; responseCursor?: string; hasMore?: string; itemPath?: string; advancement?: string; maxPages: number; maxItems: number; maxElapsedMs: number; maxMemoryBytes: number; repeatedCursorLimit: number; repeatedPageLimit: number; pageSize: number };

function normalizeParameterValue(value: unknown): IDataObject[string] {
  if (value && typeof value === 'object' && 'value' in value) return (value as { value: IDataObject[string] }).value;
  return value as IDataObject[string];
}


type BodyFieldContract = {
  name: string;
  displayName?: string;
  description?: string;
  type?: string;
  format?: string;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  pattern?: string;
  fields?: BodyFieldContract[];
  items?: BodyFieldContract;
  additionalValue?: BodyFieldContract;
  alternatives?: BodyFieldContract[];
  composition?: 'oneOf' | 'anyOf';
  representation?: string;
  nullable?: boolean;
};

function normalizeJsonValue(value: unknown, label: string, context: IExecuteFunctions, itemIndex: number): IDataObject | IDataObject[] | string | number | boolean | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as IDataObject | IDataObject[] | string | number | boolean | null;
    } catch (error) {
      throw new NodeOperationError(context.getNode(), `${label} must be valid JSON: ${(error as Error).message}`, { itemIndex });
    }
  }
  if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value as IDataObject | IDataObject[] | string | number | boolean | null;
  throw new NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}


function validateBodyValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): void {
  if (value === undefined || value === '') {
    if (contract.required) throw new NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
    return;
  }
  if (value === null) {
    if (contract.nullable) return;
    throw new NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
  }
  if (contract.alternatives?.length) {
    selectAlternativeValue(value, contract, path, context, itemIndex);
    return;
  }
  if (contract.type === 'string' && typeof value !== 'string') throw new NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
  if (contract.type === 'boolean' && typeof value !== 'boolean') throw new NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
  if (contract.type === 'number' && typeof value !== 'number') throw new NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
  if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) throw new NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
  if (contract.enum?.length) {
    const enumValueMatches = (candidate: unknown): boolean => candidate === value ||
      (candidate === null && value === 'null') ||
      (candidate === 'null' && value === null) ||
      Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
    const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
    const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
      ? value.every((item) => contract.enum!.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
      : contract.enum.some(enumValueMatches);
    if (!matches) throw new NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
  }
  if (contract.type === 'number' || contract.type === 'integer') {
    const numeric = value as number;
    if (contract.minValue !== undefined && numeric < contract.minValue) throw new NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
    if (contract.maxValue !== undefined && numeric > contract.maxValue) throw new NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
  }
  if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value)) throw new NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
  if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
  if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
    try {
      new URL(value);
    } catch {
      throw new NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
    }
  }
  if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
  if (contract.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
    const objectValue = value as IDataObject;
    for (const child of contract.fields ?? []) validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
    if (contract.additionalValue) {
      const known = new Set((contract.fields ?? []).map((field) => field.name));
      for (const [key, childValue] of Object.entries(objectValue)) {
        if (!known.has(key)) {
          if (contract.additionalValue.alternatives?.length && contract.additionalValue.representation === 'raw') continue;
          validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
        }
      }
    }
  }
  if (contract.type === 'array') {
    if (!Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
    if (contract.items) value.forEach((item, index) => validateBodyValue(item, contract.items!, `${path}[${index}]`, context, itemIndex));
  }
}

function setBodyField(body: IDataObject, contract: BodyFieldContract, value: unknown, context: IExecuteFunctions, itemIndex: number): void {
  const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
    ? normalizeJsonValue(value, contract.displayName ?? contract.name, context, itemIndex)
    : normalizeParameterValue(value);
  const selected = contract.alternatives?.length ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
  validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
  body[contract.name] = selected as IDataObject[string];
}


function selectAlternativeValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
  const selectedName = String((value as IDataObject).schemaAlternative ?? '');
  const selected = (contract.alternatives ?? []).find((alternative) => alternative.name === selectedName);
  if (!selected) throw new NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${(contract.alternatives ?? []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
  const selectedValue = (value as IDataObject).value;
  validateBodyValue(selectedValue, selected, path, context, itemIndex);
  return selectedValue;
}




function selectResponseFields(value: IDataObject, fields: string[]): IDataObject {
  if (fields.length === 0) return value;
  const selected: IDataObject = {};
  if (value.id !== undefined) selected.id = value.id;
  for (const field of fields) if (value[field] !== undefined) selected[field] = value[field];
  return selected;
}

function valueAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').filter(Boolean).reduce((current: unknown, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    return (current as IDataObject)[segment];
  }, value);
}

export class Sendpilot implements INodeType {
  description: INodeTypeDescription = {
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
        subtitle: "={{$parameter[\"operation\"] + \": \" + $parameter[\"resource\"]}}",
        description: "Manage LinkedIn outreach campaigns, track lead statuses, and monitor credit balances with SendPilot",
        hints: [
            {
                message: "Operation \"listCampaigns\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getLeadDatabaseSearchResults\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getLeadExtractorCampaignResults\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"listLeads\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
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
            NodeConnectionTypes.Main
        ],
        outputs: [
            NodeConnectionTypes.Main
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
                default: "getCampaign",
                options: [
                    {
                        name: "Get",
                        value: "getCampaign",
                        action: "Get campaign",
                        description: "Retrieves detailed configuration, lead metrics, and connected sender accounts for a specific campaign"
                    },
                    {
                        name: "List",
                        value: "listCampaigns",
                        action: "List campaigns",
                        description: "Retrieves a paginated list of linkedin outreach campaigns filtered by status"
                    },
                    {
                        name: "Update",
                        value: "updateCampaign",
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
                            "getCampaign"
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
                            "getCampaign"
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
                    "description",
                    "createdAt",
                    "updatedAt",
                    "connectionsSent",
                    "messagesSent",
                    "repliesReceived"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "campaigns"
                        ],
                        operation: [
                            "getCampaign"
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
                        name: "Description",
                        value: "description"
                    },
                    {
                        name: "ID",
                        value: "id"
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
                            "listCampaigns"
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
                        description: "Page number",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "options",
                        default: "active",
                        description: "Filter by campaign status",
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
                            "updateCampaign"
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
                description: "Operation on the campaign",
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
                            "updateCampaign"
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
                default: "getCredits",
                options: [
                    {
                        name: "Get",
                        value: "getCredits",
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
                            "inbox"
                        ]
                    }
                },
                default: "getConversationMessages",
                options: [
                    {
                        name: "Get Conversation Messages",
                        value: "getConversationMessages",
                        action: "Get conversation messages inbox",
                        description: "Retrieves message history and attachments for a specific linkedin conversation thread. inbox."
                    },
                    {
                        name: "Get Many Conversations",
                        value: "listConversations",
                        action: "Get many conversations inbox",
                        description: "Retrieves linkedin message threads across connected sender accounts with continuation token pagination. inbox."
                    },
                    {
                        name: "Get Many Senders",
                        value: "listSenders",
                        action: "Get many senders inbox",
                        description: "Retrieves connected linkedin sender accounts along with daily message limits and usage. inbox."
                    },
                    {
                        name: "Send Connection Request",
                        value: "sendConnectionRequest",
                        action: "Send connection request inbox",
                        description: "Dispatches a linkedin connection request with an optional note to a target profile. inbox."
                    },
                    {
                        name: "Send Message",
                        value: "sendMessage",
                        action: "Send message inbox",
                        description: "Sends a direct message to a linkedin profile URL using a connected sender account. inbox."
                    },
                    {
                        name: "Send Message To Lead",
                        value: "sendMessageToLead",
                        action: "Send message to lead inbox",
                        description: "Sends a templated linkedin message directly to an existing lead by lead ID. inbox."
                    }
                ]
            },
            {
                displayName: "Conversation ID",
                name: "conversationId",
                type: "string",
                default: "",
                required: true,
                description: "The conversation/chat ID to fetch messages from",
                displayOptions: {
                    show: {
                        resource: [
                            "inbox"
                        ],
                        operation: [
                            "getConversationMessages"
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
                description: "The linkedin sender account ID that owns this conversation",
                displayOptions: {
                    show: {
                        resource: [
                            "inbox"
                        ],
                        operation: [
                            "getConversationMessages"
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
                            "getConversationMessages"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Continuation Token",
                        name: "continuationToken",
                        type: "string",
                        default: "",
                        description: "Token for fetching the next page of messages. returned in the previous response.",
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
                            "listConversations"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Account ID",
                        name: "accountId",
                        type: "string",
                        default: "",
                        description: "Filter by specific linkedin sender account ID. if not provided, returns conversations from all accounts."
                    },
                    {
                        displayName: "Continuation Token",
                        name: "continuationToken",
                        type: "string",
                        default: "",
                        description: "Token for fetching the next page of conversations. returned in the previous response.",
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
                description: "The linkedin profile URL of the person to connect with",
                displayOptions: {
                    show: {
                        resource: [
                            "inbox"
                        ],
                        operation: [
                            "sendConnectionRequest"
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
                description: "The linkedin sender account ID to use",
                displayOptions: {
                    show: {
                        resource: [
                            "inbox"
                        ],
                        operation: [
                            "sendConnectionRequest"
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
                            "sendConnectionRequest"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Message",
                        name: "message",
                        type: "string",
                        default: "",
                        description: "Optional connection note. only works for premium linkedin accounts."
                    }
                ]
            },
            {
                displayName: "Message",
                name: "message",
                type: "string",
                default: "",
                required: true,
                description: "Message content (max 8000 characters)",
                displayOptions: {
                    show: {
                        resource: [
                            "inbox"
                        ],
                        operation: [
                            "sendMessage"
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
                description: "Linkedin profile URL of the recipient",
                displayOptions: {
                    show: {
                        resource: [
                            "inbox"
                        ],
                        operation: [
                            "sendMessage"
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
                description: "Linkedin sender account ID to use",
                displayOptions: {
                    show: {
                        resource: [
                            "inbox"
                        ],
                        operation: [
                            "sendMessage"
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
                            "sendMessage"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Campaign ID",
                        name: "campaignId",
                        type: "string",
                        default: "",
                        description: "Optional campaign ID for tracking"
                    },
                    {
                        displayName: "Lead ID",
                        name: "leadId",
                        type: "string",
                        default: "",
                        description: "Optional lead ID for tracking"
                    }
                ]
            },
            {
                displayName: "Lead ID",
                name: "leadId",
                type: "string",
                default: "",
                required: true,
                description: "The lead ID to send the message to",
                displayOptions: {
                    show: {
                        resource: [
                            "inbox"
                        ],
                        operation: [
                            "sendMessageToLead"
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
                description: "The message content to send. supports template variables: `{{firstname}}` (lead's first name), `{{lastname}}` (lead's last name).",
                displayOptions: {
                    show: {
                        resource: [
                            "inbox"
                        ],
                        operation: [
                            "sendMessageToLead"
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
                description: "The linkedin sender account ID to use",
                displayOptions: {
                    show: {
                        resource: [
                            "inbox"
                        ],
                        operation: [
                            "sendMessageToLead"
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
                            "leadDatabase"
                        ]
                    }
                },
                default: "createLeadDatabaseSearch",
                options: [
                    {
                        name: "Create Database Search",
                        value: "createLeadDatabaseSearch",
                        action: "Create database search lead database",
                        description: "Initiates an asynchronous b2b lead search matching professional, company, and technology filters. lead database."
                    },
                    {
                        name: "Get Database Search Results",
                        value: "getLeadDatabaseSearchResults",
                        action: "Get database search results lead database",
                        description: "Retrieves paginated lead records and contact details from a completed database search. lead database."
                    },
                    {
                        name: "Get Database Search Status",
                        value: "getLeadDatabaseSearchStatus",
                        action: "Get database search status lead database",
                        description: "Checks the execution progress and completion status of a lead database search job"
                    }
                ]
            },
            {
                displayName: "Filters",
                name: "filters",
                type: "json",
                default: {},
                required: true,
                description: "Comprehensive filters for lead database search. all filters are optional and can be combined.",
                displayOptions: {
                    show: {
                        resource: [
                            "leadDatabase"
                        ],
                        operation: [
                            "createLeadDatabaseSearch"
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
                            "createLeadDatabaseSearch"
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
                description: "A name for this search (for your reference)",
                displayOptions: {
                    show: {
                        resource: [
                            "leadDatabase"
                        ],
                        operation: [
                            "createLeadDatabaseSearch"
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
                            "createLeadDatabaseSearch"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Webhook URL",
                        name: "webhook_url",
                        type: "string",
                        default: "",
                        description: "Optional URL to receive webhook when search completes",
                        hint: "Expected format: uri"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Search ID",
                displayOptions: {
                    show: {
                        resource: [
                            "leadDatabase"
                        ],
                        operation: [
                            "getLeadDatabaseSearchResults"
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
                            "getLeadDatabaseSearchResults"
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
                        description: "Page number",
                        typeOptions: {
                            minValue: 1
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
                description: "Search ID",
                displayOptions: {
                    show: {
                        resource: [
                            "leadDatabase"
                        ],
                        operation: [
                            "getLeadDatabaseSearchStatus"
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
                            "leadExtractor"
                        ]
                    }
                },
                default: "createLeadExtractorCampaign",
                options: [
                    {
                        name: "Create Lead Extractor Campaign",
                        value: "createLeadExtractorCampaign",
                        action: "Create lead extractor campaign",
                        description: "Launches a scraping job to extract and enrich leads from linkedin or sales navigator search URLs. lead extractor."
                    },
                    {
                        name: "Get Extractor Campaign Results",
                        value: "getLeadExtractorCampaignResults",
                        action: "Get extractor campaign results lead extractor",
                        description: "Retrieves paginated lead profiles, job history, and contact information from a finished extraction job. lead extractor."
                    },
                    {
                        name: "Get Extractor Campaign Status",
                        value: "getLeadExtractorCampaignStatus",
                        action: "Get extractor campaign status lead extractor",
                        description: "Retrieves the progress percentage and extraction status of a lead scraping campaign. lead extractor."
                    }
                ]
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
                            "createLeadExtractorCampaign"
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
                description: "A name for this extraction campaign",
                displayOptions: {
                    show: {
                        resource: [
                            "leadExtractor"
                        ],
                        operation: [
                            "createLeadExtractorCampaign"
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
                description: "Linkedin search URLs to extract leads from",
                displayOptions: {
                    show: {
                        resource: [
                            "leadExtractor"
                        ],
                        operation: [
                            "createLeadExtractorCampaign"
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
                            "createLeadExtractorCampaign"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Mode",
                        name: "mode",
                        type: "options",
                        default: "extraction_only",
                        description: "Extraction mode",
                        options: [
                            {
                                name: "Extraction Only",
                                value: "extraction_only"
                            },
                            {
                                name: "With Enrichment",
                                value: "with_enrichment"
                            }
                        ]
                    },
                    {
                        displayName: "URL Type",
                        name: "url_type",
                        type: "options",
                        default: "linkedin_search",
                        description: "Type of URLs provided",
                        options: [
                            {
                                name: "Linkedin Search",
                                value: "linkedin_search"
                            },
                            {
                                name: "Sales Navigator",
                                value: "sales_navigator"
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
                description: "The campaign ID returned from the create campaign endpoint",
                displayOptions: {
                    show: {
                        resource: [
                            "leadExtractor"
                        ],
                        operation: [
                            "getLeadExtractorCampaignResults"
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
                            "getLeadExtractorCampaignResults"
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
                        description: "Number of leads to skip (for pagination)",
                        typeOptions: {
                            minValue: 0
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
                description: "The campaign ID returned from the create campaign endpoint",
                displayOptions: {
                    show: {
                        resource: [
                            "leadExtractor"
                        ],
                        operation: [
                            "getLeadExtractorCampaignStatus"
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
                            "leads"
                        ]
                    }
                },
                default: "addLeadsToCampaign",
                options: [
                    {
                        name: "Add Leads To Campaign",
                        value: "addLeadsToCampaign",
                        action: "Add leads to campaign",
                        description: "Adds one or more leads with profile attributes and custom fields to an outreach campaign"
                    },
                    {
                        name: "Get",
                        value: "getLeadById",
                        action: "Get lead",
                        description: "Retrieves profile information, company data, and outreach history for a specific lead"
                    },
                    {
                        name: "Get Many",
                        value: "listLeads",
                        action: "Get many leads",
                        description: "Retrieves a paginated list of leads filtered by campaign ID and outreach progress status"
                    },
                    {
                        name: "Update Lead Status",
                        value: "updateLeadStatus",
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
                description: "Campaign ID to add leads to",
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "addLeadsToCampaign"
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
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "addLeadsToCampaign"
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
                description: "Lead ID",
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "getLeadById"
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
                            "listLeads"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Campaign ID",
                        name: "campaignId",
                        type: "string",
                        default: "",
                        description: "Filter by campaign ID"
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
                        description: "Page number",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "options",
                        default: "PENDING",
                        description: "Filter by lead status",
                        options: [
                            {
                                name: "CONNECTION ACCEPTED",
                                value: "CONNECTION_ACCEPTED"
                            },
                            {
                                name: "CONNECTION SENT",
                                value: "CONNECTION_SENT"
                            },
                            {
                                name: "DONE",
                                value: "DONE"
                            },
                            {
                                name: "MESSAGE SENT",
                                value: "MESSAGE_SENT"
                            },
                            {
                                name: "PENDING",
                                value: "PENDING"
                            },
                            {
                                name: "REPLY RECEIVED",
                                value: "REPLY_RECEIVED"
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
                description: "Lead ID",
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "updateLeadStatus"
                        ]
                    }
                }
            },
            {
                displayName: "Status",
                name: "status",
                type: "options",
                default: "PENDING",
                required: true,
                description: "New status for the lead",
                options: [
                    {
                        name: "CONNECTION ACCEPTED",
                        value: "CONNECTION_ACCEPTED"
                    },
                    {
                        name: "CONNECTION SENT",
                        value: "CONNECTION_SENT"
                    },
                    {
                        name: "DONE",
                        value: "DONE"
                    },
                    {
                        name: "MESSAGE SENT",
                        value: "MESSAGE_SENT"
                    },
                    {
                        name: "PENDING",
                        value: "PENDING"
                    },
                    {
                        name: "REPLY RECEIVED",
                        value: "REPLY_RECEIVED"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "updateLeadStatus"
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
                            "updateLeadStatus"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Note",
                        name: "note",
                        type: "string",
                        default: "",
                        description: "Optional note for the status change"
                    }
                ]
            }
        ]
    };

  public async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const output: INodeExecutionData[] = [];
    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
      const outputStart = output.length;
      let errorPlan: Record<string, { title: string; recovery?: string; parameter?: string }> = {};
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const nodeVersion = this.getNode().typeVersion;
        let additionalFields: IDataObject = {};
        const nodeOptions = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
        
        let retryContract: RetryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
        let credentialApplications: CredentialApplication[] | undefined;
        let options: IHttpRequestOptions;
        let pagination: PaginationContract = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        let responsePlan: { binary: boolean; full: boolean; envelopePath: string; itemPath: string; fields: string[]; simplified: string[] } = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        switch (operation) {
          case "getCampaign": {
        
        
        let path = "/v1/campaigns/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["connectionsSent","createdAt","description","id","linkedInSenderIds","messagesSent","name","repliesReceived","status","totalLeads","type","updatedAt"], simplified: ["id","name","status","type","description","createdAt","updatedAt","connectionsSent","messagesSent","repliesReceived"] };
        errorPlan = {"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "listCampaigns": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v1/campaigns";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["status"] !== undefined) qs["status"] = additionalFields["status"];
    if (additionalFields["page"] !== undefined) qs["page"] = additionalFields["page"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["campaigns","pagination"], simplified: ["campaigns","pagination"] };
        errorPlan = {"401":{"title":"Unauthorized"}};
        break;
      }
    case "updateCampaign": {
        
        
        let path = "/v1/campaigns/{id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"action","displayName":"Action","type":"string","required":true,"description":"Action to perform on the campaign","enum":["pause","resume"]}, this.getNodeParameter("action", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["action","campaignId","message","newStatus","success"], simplified: ["action","campaignId","message","newStatus","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "getCredits": {
        
        
        const path = "/v1/credits";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["available","nextResetDate","purchased","subscription","used"], simplified: ["available","nextResetDate","purchased","subscription","used"] };
        errorPlan = {"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "getConversationMessages": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v1/inbox/conversations/{conversationId}/messages";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{conversationId}").join(encodeURIComponent(String(this.getNodeParameter("conversationId", itemIndex))));
    qs["accountId"] = this.getNodeParameter("accountId", itemIndex);
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["continuationToken"] !== undefined) qs["continuationToken"] = additionalFields["continuationToken"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["conversationId","messages","pagination"], simplified: ["conversationId","messages","pagination"] };
        errorPlan = {"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "listConversations": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v1/inbox/conversations";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["accountId"] !== undefined) qs["accountId"] = additionalFields["accountId"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["continuationToken"] !== undefined) qs["continuationToken"] = additionalFields["continuationToken"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["conversations","pagination"], simplified: ["conversations","pagination"] };
        errorPlan = {"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "listSenders": {
        
        
        const path = "/v1/inbox/senders";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["senders","total"], simplified: ["senders","total"] };
        errorPlan = {"401":{"title":"Unauthorized"}};
        break;
      }
    case "sendConnectionRequest": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v1/inbox/connect";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["message"] !== undefined) setBodyField(body as IDataObject, {"name":"message","displayName":"Message","type":"string","description":"Optional connection note. Only works for premium LinkedIn accounts."}, additionalFields["message"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"recipientLinkedinUrl","displayName":"Recipient Linkedin Url","type":"string","required":true,"description":"The LinkedIn profile URL of the person to connect with"}, this.getNodeParameter("recipientLinkedinUrl", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"senderId","displayName":"Sender Id","type":"string","required":true,"description":"The LinkedIn sender account ID to use"}, this.getNodeParameter("senderId", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["recipientLinkedinUrl","requestId","status","success","timestamp"], simplified: ["recipientLinkedinUrl","requestId","status","success","timestamp"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "sendMessage": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v1/inbox/send";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["campaignId"] !== undefined) setBodyField(body as IDataObject, {"name":"campaignId","displayName":"Campaign Id","type":"string","description":"Optional campaign ID for tracking"}, additionalFields["campaignId"], this, itemIndex);
    if (additionalFields["leadId"] !== undefined) setBodyField(body as IDataObject, {"name":"leadId","displayName":"Lead Id","type":"string","description":"Optional lead ID for tracking"}, additionalFields["leadId"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"message","displayName":"Message","type":"string","required":true,"description":"Message content (max 8000 characters)"}, this.getNodeParameter("message", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"recipientLinkedinUrl","displayName":"Recipient Linkedin Url","type":"string","required":true,"description":"LinkedIn profile URL of the recipient"}, this.getNodeParameter("recipientLinkedinUrl", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"senderId","displayName":"Sender Id","type":"string","required":true,"description":"LinkedIn sender account ID to use"}, this.getNodeParameter("senderId", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["leadId","messageId","recipientLinkedinUrl","status","success","timestamp"], simplified: ["leadId","messageId","recipientLinkedinUrl","status","success","timestamp"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "sendMessageToLead": {
        
        
        let path = "/v1/inbox/send/lead/{leadId}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{leadId}").join(encodeURIComponent(String(this.getNodeParameter("leadId", itemIndex))));
        setBodyField(body as IDataObject, {"name":"message","displayName":"Message","type":"string","required":true,"description":"The message content to send. Supports template variables:\n`{{firstName}}` (lead's first name), `{{lastName}}` (lead's last name)."}, this.getNodeParameter("message", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"senderId","displayName":"Sender Id","type":"string","required":true,"description":"The LinkedIn sender account ID to use"}, this.getNodeParameter("senderId", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["leadId","messageId","recipientLinkedinUrl","status","success","timestamp"], simplified: ["leadId","messageId","recipientLinkedinUrl","status","success","timestamp"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "createLeadDatabaseSearch": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v1/lead-database/searches";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"filters","displayName":"Filters","type":"object","required":true,"description":"Comprehensive filters for Lead Database search. All filters are optional and can be combined.","fields":[{"name":"acquired_end_date","displayName":"Acquired end date","type":"string","description":"Acquisition date range end (dd/mm/yyyy)"},{"name":"acquired_start_date","displayName":"Acquired start date","type":"string","description":"Acquisition date range start (dd/mm/yyyy)"},{"name":"bombora_composite_score","displayName":"Bombora composite score","type":"array","description":"Intent score ranges to filter by","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"bombora_topic","displayName":"Bombora topic","type":"array","description":"Bombora intent topics","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"bulk_domains","displayName":"Bulk domains","type":"string","description":"Company domains, comma-separated"},{"name":"companies","displayName":"Companies","type":"array","description":"Company names to include","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"company_linkedin_username","displayName":"Company linkedin username","type":"array","description":"Company LinkedIn usernames/URLs","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"company_sizes","displayName":"Company sizes","type":"array","description":"Company size ranges","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"company_status_comment","displayName":"Company status comment","type":"array","description":"Status comments to filter by","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"company_status_value","displayName":"Company status value","type":"string","description":"Company status","enum":["active","closed"]},{"name":"company_type","displayName":"Company type","type":"array","description":"Company types","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"demo_available","displayName":"Demo available","type":"boolean","description":"Company offers product demos"},{"name":"documentation_exist","displayName":"Documentation exist","type":"boolean","description":"Company has public documentation"},{"name":"education_institute","displayName":"Education institute","type":"array","description":"Educational institutions","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"education_keyword","displayName":"Education keyword","type":"array","description":"Keywords to search in education history","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"education_major","displayName":"Education major","type":"array","description":"Fields of study/majors","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_bulk_domains","displayName":"Excluded bulk domains","type":"string","description":"Company domains to exclude, comma-separated"},{"name":"excluded_companies","displayName":"Excluded companies","type":"array","description":"Company names to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_company_linkedin_username","displayName":"Excluded company linkedin username","type":"array","description":"Company LinkedIn usernames to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_company_sizes","displayName":"Excluded company sizes","type":"array","description":"Company sizes to exclude using mapped integer values","items":{"name":"item","displayName":"Item","type":"number"},"representation":"raw"},{"name":"excluded_company_type","displayName":"Excluded company type","type":"array","description":"Company types to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_education_institute","displayName":"Excluded education institute","type":"array","description":"Institutions to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_education_keyword","displayName":"Excluded education keyword","type":"array","description":"Education keywords to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_education_major","displayName":"Excluded education major","type":"array","description":"Majors to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_experimental_department","displayName":"Excluded experimental department","type":"array","description":"Experimental departments to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_experimental_industries","displayName":"Excluded experimental industries","type":"array","description":"Experimental industries to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_hq_location","displayName":"Excluded hq location","type":"array","description":"HQ locations to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_industries","displayName":"Excluded industries","type":"array","description":"Industries to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_job_posting_functions","displayName":"Excluded job posting functions","type":"array","description":"Job functions to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_job_posting_location","displayName":"Excluded job posting location","type":"array","description":"Job posting locations to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_job_posting_title","displayName":"Excluded job posting title","type":"array","description":"Job posting titles to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_job_titles","displayName":"Excluded job titles","type":"array","description":"Job titles to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_keywords","displayName":"Excluded keywords","type":"array","description":"Keywords to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_language_proficiency","displayName":"Excluded language proficiency","type":"array","description":"Language proficiency levels to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_languages","displayName":"Excluded languages","type":"array","description":"Languages to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_locations","displayName":"Excluded locations","type":"array","description":"Locations/countries to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_member_certifications","displayName":"Excluded member certifications","type":"array","description":"Certifications to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_member_department","displayName":"Excluded member department","type":"array","description":"Departments to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_member_description","displayName":"Excluded member description","type":"array","description":"Keywords to exclude from profile summaries","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_member_linkedin_username","displayName":"Excluded member linkedin username","type":"array","description":"LinkedIn usernames or profile URLs to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_member_skills","displayName":"Excluded member skills","type":"array","description":"Professional skills to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_naics_codes","displayName":"Excluded naics codes","type":"array","description":"NAICS codes to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_news_articles","displayName":"Excluded news articles","type":"array","description":"News keywords to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_recommendation_keyword","displayName":"Excluded recommendation keyword","type":"array","description":"Recommendation keywords to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_recommendation_linkedin_username","displayName":"Excluded recommendation linkedin username","type":"array","description":"Recommender usernames to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_seniority_levels","displayName":"Excluded seniority levels","type":"array","description":"Seniority levels to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_sic_codes","displayName":"Excluded sic codes","type":"array","description":"SIC codes to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_technologies_used","displayName":"Excluded technologies used","type":"array","description":"Technologies to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"excluded_top_topics","displayName":"Excluded top topics","type":"array","description":"Website topics to exclude","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"experimental_industries","displayName":"Experimental industries","type":"array","description":"Experimental/emerging industry classifications","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"experimental_member_department","displayName":"Experimental member department","type":"array","description":"Experimental/emerging department classifications","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"free_trial_available","displayName":"Free trial available","type":"boolean","description":"Company offers free trials"},{"name":"hq_location","displayName":"Hq location","type":"array","description":"Company headquarters locations","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"industries","displayName":"Industries","type":"array","description":"Industries to include","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"ipo_end_date","displayName":"Ipo end date","type":"string","description":"IPO date range end (dd/mm/yyyy)"},{"name":"ipo_start_date","displayName":"Ipo start date","type":"string","description":"IPO date range start (dd/mm/yyyy)"},{"name":"is_b2b","displayName":"Is b2b","type":"boolean","description":"Filter for B2B companies only"},{"name":"is_downloadable","displayName":"Is downloadable","type":"boolean","description":"Company offers downloadable products"},{"name":"is_public","displayName":"Is public","type":"boolean","description":"Filter for publicly listed companies only"},{"name":"job_posting_end_date","displayName":"Job posting end date","type":"string","description":"Job posting date range end (dd/mm/yyyy)"},{"name":"job_posting_functions","displayName":"Job posting functions","type":"array","description":"Job functions being recruited","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"job_posting_location","displayName":"Job posting location","type":"array","description":"Job posting locations","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"job_posting_seniority","displayName":"Job posting seniority","type":"array","description":"Job posting seniority level","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"job_posting_start_date","displayName":"Job posting start date","type":"string","description":"Job posting date range start (dd/mm/yyyy)"},{"name":"job_posting_title","displayName":"Job posting title","type":"array","description":"Job titles being recruited","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"job_posting_type","displayName":"Job posting type","type":"array","description":"Employment type","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"job_titles","displayName":"Job titles","type":"array","description":"Job titles to include","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"keywords","displayName":"Keywords","type":"array","description":"General keywords to search for","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"language_proficiency","displayName":"Language proficiency","type":"array","description":"Language proficiency levels","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"languages","displayName":"Languages","type":"array","description":"Languages spoken","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"last_funding_date","displayName":"Last funding date","type":"string","description":"Last funding date range","enum":["30","60","90","90+"]},{"name":"last_funding_round_name","displayName":"Last funding round name","type":"array","description":"Funding round names","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"locations","displayName":"Locations","type":"array","description":"Locations/countries to include","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"max_average_visit_duration_seconds","displayName":"Max average visit duration seconds","type":"number","description":"Maximum visit duration in seconds"},{"name":"max_bounce_rate","displayName":"Max bounce rate","type":"number","description":"Maximum bounce rate percentage"},{"name":"max_company_employee_reviews_aggregate_score","displayName":"Max company employee reviews aggregate score","type":"number","description":"Maximum employee satisfaction score"},{"name":"max_job_duration_months","displayName":"Max job duration months","type":"number","description":"Maximum duration at current job in months"},{"name":"max_last_funding_round_amount_raised","displayName":"Max last funding round amount raised","type":"number","description":"Maximum funding amount"},{"name":"max_pages_per_visit","displayName":"Max pages per visit","type":"number","description":"Maximum pages per visit"},{"name":"max_rank_category","displayName":"Max rank category","type":"number","description":"Maximum category ranking"},{"name":"max_rank_country","displayName":"Max rank country","type":"number","description":"Maximum country-specific ranking"},{"name":"max_rank_global","displayName":"Max rank global","type":"number","description":"Maximum global website ranking"},{"name":"max_revenue_annual","displayName":"Max revenue annual","type":"number","description":"Maximum annual revenue"},{"name":"max_total_experience_duration_months","displayName":"Max total experience duration months","type":"number","description":"Maximum total professional experience in months"},{"name":"max_total_website_visits_monthly","displayName":"Max total website visits monthly","type":"number","description":"Maximum monthly website visits"},{"name":"member_certifications","displayName":"Member certifications","type":"array","description":"Professional certifications","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"member_department","displayName":"Member department","type":"array","description":"Standard departments","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"member_description","displayName":"Member description","type":"array","description":"Keywords to search in profile summaries","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"member_full_name","displayName":"Member full name","type":"string","description":"Free-text search by person name"},{"name":"member_linkedin_username","displayName":"Member linkedin username","type":"array","description":"LinkedIn usernames or profile URLs to include","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"member_skills","displayName":"Member skills","type":"array","description":"Professional skills to include","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"min_average_visit_duration_seconds","displayName":"Min average visit duration seconds","type":"number","description":"Minimum visit duration in seconds"},{"name":"min_bounce_rate","displayName":"Min bounce rate","type":"number","description":"Minimum bounce rate percentage"},{"name":"min_company_employee_reviews_aggregate_score","displayName":"Min company employee reviews aggregate score","type":"number","description":"Minimum employee satisfaction score"},{"name":"min_job_duration_months","displayName":"Min job duration months","type":"number","description":"Minimum duration at current job in months"},{"name":"min_last_funding_round_amount_raised","displayName":"Min last funding round amount raised","type":"number","description":"Minimum funding amount"},{"name":"min_pages_per_visit","displayName":"Min pages per visit","type":"number","description":"Minimum pages per visit"},{"name":"min_rank_category","displayName":"Min rank category","type":"number","description":"Minimum category ranking"},{"name":"min_rank_country","displayName":"Min rank country","type":"number","description":"Minimum country-specific ranking"},{"name":"min_rank_global","displayName":"Min rank global","type":"number","description":"Minimum global website ranking"},{"name":"min_revenue_annual","displayName":"Min revenue annual","type":"number","description":"Minimum annual revenue"},{"name":"min_total_experience_duration_months","displayName":"Min total experience duration months","type":"number","description":"Minimum total professional experience in months"},{"name":"min_total_website_visits_monthly","displayName":"Min total website visits monthly","type":"number","description":"Minimum monthly website visits"},{"name":"mobile_apps_exist","displayName":"Mobile apps exist","type":"boolean","description":"Company has mobile applications"},{"name":"naics_codes","displayName":"Naics codes","type":"array","description":"NAICS (North American Industry Classification System) codes","items":{"name":"item","displayName":"Item","type":"object","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"},"representation":"raw"},{"name":"news_articles","displayName":"News articles","type":"array","description":"Keywords in recent news articles","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"online_reviews_exist","displayName":"Online reviews exist","type":"boolean","description":"Company has online reviews"},{"name":"ownership_status","displayName":"Ownership status","type":"array","description":"Ownership status filter","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"pricing_available","displayName":"Pricing available","type":"boolean","description":"Company has public pricing page"},{"name":"recommendation_keyword","displayName":"Recommendation keyword","type":"array","description":"Keywords in LinkedIn recommendations","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"recommendation_linkedin_username","displayName":"Recommendation linkedin username","type":"array","description":"LinkedIn usernames of recommenders","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"seniority_levels","displayName":"Seniority levels","type":"array","description":"Seniority levels","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"sic_codes","displayName":"Sic codes","type":"array","description":"SIC (Standard Industrial Classification) codes","items":{"name":"item","displayName":"Item","type":"object","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"},"representation":"raw"},{"name":"technologies_used","displayName":"Technologies used","type":"array","description":"Technologies used","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"},{"name":"top_topics","displayName":"Top topics","type":"array","description":"Website topics to include","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"}],"representation":"raw"}, this.getNodeParameter("filters", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"limit","displayName":"Limit","type":"integer","required":true,"minValue":1,"maxValue":10000,"description":"Maximum number of leads to find (1-10000)"}, this.getNodeParameter("limit", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string","required":true,"description":"A name for this search (for your reference)"}, this.getNodeParameter("name", itemIndex), this, itemIndex);
    if (additionalFields["webhook_url"] !== undefined) setBodyField(body as IDataObject, {"name":"webhook_url","displayName":"Webhook url","type":"string","format":"uri","description":"Optional URL to receive webhook when search completes"}, additionalFields["webhook_url"], this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_at","id","name","status"], simplified: ["created_at","id","name","status"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "getLeadDatabaseSearchResults": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v1/lead-database/searches/{id}/results";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["page"] !== undefined) qs["page"] = additionalFields["page"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["id","pagination","results","status"], simplified: ["id","pagination","results","status"] };
        errorPlan = {"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "getLeadDatabaseSearchStatus": {
        
        
        let path = "/v1/lead-database/searches/{id}/status";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["completed_at","created_at","id","name","progress","status","totalResults"], simplified: ["completed_at","created_at","id","name","progress","status","totalResults"] };
        errorPlan = {"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "createLeadExtractorCampaign": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v1/lead-extractor/campaigns";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"limit","displayName":"Limit","type":"integer","required":true,"minValue":1,"maxValue":10000,"description":"Maximum number of leads to extract"}, this.getNodeParameter("limit", itemIndex), this, itemIndex);
    if (additionalFields["mode"] !== undefined) setBodyField(body as IDataObject, {"name":"mode","displayName":"Mode","type":"string","description":"Extraction mode","enum":["extraction_only","with_enrichment"],"default":"extraction_only"}, additionalFields["mode"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string","required":true,"description":"A name for this extraction campaign"}, this.getNodeParameter("name", itemIndex), this, itemIndex);
    if (additionalFields["url_type"] !== undefined) setBodyField(body as IDataObject, {"name":"url_type","displayName":"Url type","type":"string","description":"Type of URLs provided","enum":["linkedin_search","sales_navigator"],"default":"linkedin_search"}, additionalFields["url_type"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"urls","displayName":"Urls","type":"array","required":true,"description":"LinkedIn search URLs to extract leads from","items":{"name":"item","displayName":"Item","type":"string"},"representation":"raw"}, this.getNodeParameter("urls", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_at","estimated_credits","id","name","status"], simplified: ["created_at","estimated_credits","id","name","status"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"}};
        break;
      }
    case "getLeadExtractorCampaignResults": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v1/lead-extractor/campaigns/{id}/results";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["leads","pagination"], simplified: ["leads","pagination"] };
        errorPlan = {"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "getLeadExtractorCampaignStatus": {
        
        
        let path = "/v1/lead-extractor/campaigns/{id}/status";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_at","id","name","progress","status"], simplified: ["created_at","id","name","progress","status"] };
        errorPlan = {"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "addLeadsToCampaign": {
        
        
        const path = "/v1/leads";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"campaignId","displayName":"Campaign Id","type":"string","required":true,"description":"Campaign ID to add leads to"}, this.getNodeParameter("campaignId", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"leads","displayName":"Leads","type":"array","required":true,"items":{"name":"item","displayName":"Item","type":"object","description":"Lead object with required LinkedIn URL and optional fields.\nAny additional properties beyond the defined ones will be stored as custom fields\nfor personalization in campaign messages.","example":{"company":"TechCorp","firstName":"John","industry":"Technology","lastName":"Doe","linkedinUrl":"https://www.linkedin.com/in/johndoe","region":"North America","title":"VP of Engineering"},"fields":[{"name":"company","displayName":"Company","type":"string","description":"Company name (optional)"},{"name":"email","displayName":"Email","type":"string","description":"Email address (optional)"},{"name":"firstName","displayName":"First Name","type":"string","description":"First name (optional)"},{"name":"lastName","displayName":"Last Name","type":"string","description":"Last name (optional)"},{"name":"linkedinUrl","displayName":"Linkedin Url","type":"string","required":true,"description":"LinkedIn profile URL (required)","example":"https://www.linkedin.com/in/johndoe"},{"name":"title","displayName":"Title","type":"string","description":"Job title (optional)"}],"additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"},"representation":"raw"}, this.getNodeParameter("leads", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["duplicatesSkipped","errors","invalidEntries","leadsAdded","success"], simplified: ["duplicatesSkipped","errors","invalidEntries","leadsAdded","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "getLeadById": {
        
        
        let path = "/v1/leads/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["campaignId","company","createdAt","firstName","id","lastName","linkedinUrl","status","title","updatedAt"], simplified: ["campaignId","company","createdAt","firstName","id","lastName","linkedinUrl","status","title","updatedAt"] };
        errorPlan = {"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
    case "listLeads": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/v1/leads";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["campaignId"] !== undefined) qs["campaignId"] = additionalFields["campaignId"];
    if (additionalFields["status"] !== undefined) qs["status"] = additionalFields["status"];
    if (additionalFields["page"] !== undefined) qs["page"] = additionalFields["page"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["leads","pagination"], simplified: ["leads","pagination"] };
        errorPlan = {"401":{"title":"Unauthorized"}};
        break;
      }
    case "updateLeadStatus": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/v1/leads/{id}/status";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["note"] !== undefined) setBodyField(body as IDataObject, {"name":"note","displayName":"Note","type":"string","description":"Optional note for the status change"}, additionalFields["note"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"status","displayName":"Status","type":"string","required":true,"description":"New status for the lead","enum":["PENDING","CONNECTION_SENT","CONNECTION_ACCEPTED","MESSAGE_SENT","REPLY_RECEIVED","DONE"]}, this.getNodeParameter("status", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsApiSendpilotAi","url":"https://api.sendpilot.ai","kind":"selectable","variables":[]}], "documentServer1HttpsApiSendpilotAi", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"sendpilotApi","type":"apiKey","location":"header","parameter":"X-API-Key"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["leadId","message","status","success"], simplified: ["leadId","message","status","success"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Resource not found"}};
        break;
      }
          default: throw new NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
        }
        const returnAll = pagination.style !== 'none' ? Boolean(nodeOptions.returnAll ?? false) : false;
    const resultLimit = pagination.style !== 'none' && !returnAll ? Number(nodeOptions.resultLimit ?? 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
    const pageStartTime = Date.now();
    const seenCursors = new Map<string, number>(); const seenPages = new Map<string, number>();
    let page = 1; let offset = 0; let cursor: unknown; let pagesFetched = 0; let estimatedBytes = 0; let finished = false;
    while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
      if (Date.now() - pageStartTime > pagination.maxElapsedMs) throw new NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
      const qs = options.qs as IDataObject;
      // Only the paginator's own page size is written here. It used to overwrite a
      // limit parameter the operation itself declared and the user had just set.
      if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined)) qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
      if (pagination.style === 'offset' && pagination.page) qs[pagination.page] = offset;
      if (pagination.style === 'pageNumber' && pagination.page) qs[pagination.page] = page;
      if (pagination.style === 'cursor' && pagination.cursor && cursor) qs[pagination.cursor] = cursor as string;
      const response = await requestWithRetry(this as never, options, credentialApplications, retryContract, itemIndex);
      pagesFetched += 1;
      const pageFingerprint = JSON.stringify(response);
      const pageRepeats = (seenPages.get(pageFingerprint) ?? 0) + 1;
      seenPages.set(pageFingerprint, pageRepeats);
      if (pageRepeats > pagination.repeatedPageLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
      estimatedBytes += pageFingerprint.length;
      if (estimatedBytes > pagination.maxMemoryBytes) throw new NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
      if (responsePlan.binary) {
        const binaryPayload = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
        const responseHeaders = (responsePlan.full ? ((response as IDataObject).headers as IDataObject | undefined) : undefined) ?? {};
        const contentType = String(responseHeaders['content-type'] ?? '').split(';')[0].trim() || 'application/octet-stream';
        // prepareBinaryData is what fills in fileName, fileSize and fileExtension.
        // Hand-building the binary entry produced items that downstream nodes could
        // not name or type, and discarded the response's own content type.
        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload as ArrayBuffer), undefined, contentType);
        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
        finished = true;
        continue;
      }
      const normalizedResponse = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
      const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
      if (responsePlan.envelopePath && envelopeValue === undefined) throw new NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
      const envelope = (envelopeValue ?? normalizedResponse) as IDataObject;
      const itemPath = pagination.itemPath || responsePlan.itemPath;
      const extractedItems = valueAtPath(envelope, itemPath);
      if (itemPath && extractedItems === undefined) throw new NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
      // A DELETE used to be reported as a fixed { deleted: true } with its body
      // thrown away, which lost the deleted representation and the job handle that
      // asynchronous deletes return. The body is used when there is one.
      const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse as IDataObject).length === 0));
      const values = deletedFallback
        ? [{ deleted: true }]
        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems ?? envelope];
      const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') as string : 'raw';
      const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) as string[] : [];
      for (const value of values) {
        if (output.length - outputStart >= resultLimit) break;
        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
        output.push({ json: selectResponseFields(value as IDataObject, fields), pairedItem: { item: itemIndex } });
      }
      if (!returnAll || pagination.style === 'none' || values.length === 0) { finished = true; continue; }
      if (pagination.hasMore && envelope[pagination.hasMore] === false) { finished = true; continue; }
      if (pagination.style === 'cursor') {
        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
        finished = !cursor;
        if (cursor) {
          const key = String(cursor);
          const repeats = (seenCursors.get(key) ?? 0) + 1;
          seenCursors.set(key, repeats);
          if (repeats > pagination.repeatedCursorLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
        }
      }
      if (pagination.advancement === 'offsetByItems') offset += values.length;
      if (pagination.advancement === 'incrementPage') page += 1;
    }
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
          continue;
        }
        if (error instanceof NodeApiError) {
          const status = String((error as unknown as { httpCode?: string; cause?: { statusCode?: number } }).httpCode ?? (error as unknown as { cause?: { statusCode?: number } }).cause?.statusCode ?? 'default');
          const planned = errorPlan[status] ?? errorPlan.default;
          if (planned) {
            const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
            const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
            throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex, message: planned.title, description });
          }
        }
        if (error instanceof NodeApiError) throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
      }
    }
    return [output];
  }
}
