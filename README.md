# SendPilot n8n community node

Manage LinkedIn outreach campaigns, track lead statuses, and monitor credit balances with SendPilot

Generated from OpenAPI 1.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated API key credential in n8n before using the node.

## Supported operations

- `GET /v1/campaigns/{id}` - Get Campaign
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/campaigns` - List campaigns
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v1/campaigns/{id}` - Update Campaign
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/credits` - Get Credits
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/lead-database/filters` - List lead filters and values
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/senders/quotas` - Get daily LinkedIn quotas per sender
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/me` - Get current API key and workspace
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/inbox/conversations` - Get Many Conversations
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/inbox/conversations/{conversationId}/messages` - Get Conversation Messages
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/inbox/senders` - Get Many Senders
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v1/inbox/connect` - Send Connection Request
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v1/inbox/send` - Send Message
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v1/inbox/send/lead/{leadId}` - Send Message to Lead
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/lead-database/searches/{id}/results` - Get Database Search Results
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/lead-database/searches/{id}/status` - Get Database Search Status
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v1/lead-database/searches` - Create Database Search
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/lead-extractor/campaigns/{id}/results` - Get Extractor Campaign Results
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/lead-extractor/campaigns/{id}/status` - Get Extractor Campaign Status
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v1/lead-extractor/campaigns` - Create Lead Extractor Campaign
  - Retry Contract: none
  - Pagination Contract: none
- `POST /v1/leads` - Add Leads to Campaign
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/leads/{id}` - Get Lead
  - Retry Contract: none
  - Pagination Contract: none
- `GET /v1/leads` - Get Many Leads
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /v1/leads/{id}/status` - Update Lead Status
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **SendPilot** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **SendPilot** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **SendPilot** display name.
