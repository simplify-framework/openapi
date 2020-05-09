# Simplify CodeGen
  
Based on [openapi-codegen](https://github.com/Mermade/openapi-codegen)

*Node.js-based codegen for OpenAPI documents. This project was initially by tailoring from openapi-codegen to use the core code generation functionality to generate the lambda based node projects and AWS CloudFormation stack.*

```
npm install -g simplify-codegen@latest
simplify-codegen generate -i spec.yaml -o ../output
```

## Microservices architecture in AWS:
+ AWS API Gateway REST API
  + AWS Lambda function   (service #1)
    + AWS Secret Manager  (key vault)
    + Custom resource     (external setup)
    + Manage Policy Arn   (access policy)
  + AWS Lambda function   (service #2)
    + AWS Secret Manager  (key vault)
    + Custom resource     (external setup)
    + Manage Policy Arn   (access policy)
  + AWS Lambda function   (service #3)
    + AWS Secret Manager  (key vault)
    + Custom resource     (external setup)
    + Manage Policy Arn   (access policy)

## From your existing spec.yaml, an OpenAPI specs, add extra definitions:
- `x-project-name`: to define a project which contains other resources
- `x-deployment-name`: to define a deployment environment (demo, prod)
- `x-deployment-region`: to define where to deploy resources (eu-west-1)
- `x-deployment-profile`: to define a profile that hold the deployment access
- `x-api-gateway-name`: to define an API gateway (Rest API) resource
- `x-api-authorizer-id`: provide an authorizer id that linked to API Authorizer (e.g Cognito Auhtorizer)
  - `x-[api/event]-service-name`: to define lambda functions that host the source code
  - `x-[api/event]-service-model-name`: to redirect the related routing paths into a service group
  - `x-[api/event]-service-path`: expose or dispose this service path through API gateway (public or not)
  - `x-[api/event]-service-authorizer`: enable using API Authorizer (e.g using Cognito Authorizer)
  - `x-[api/event]-service-api-key`: user API Key with `x-api-key` header to authenticate resource
  - `x-[api/event]-service-key-vault`: enable or disable key vault service (SecretManager in AWS)
  - `x-[api/event]-service-schedule`: if set to value (e.g `rate(10 minutes)`) will schedule every 10 mins
  - `x-[api/event]-service-policy`: external access policy (e.g to DynamoDB, S3, SNS...)
  - `x-[api/event]-service-custom`: integrate custom function that trigger at resource creation/deletion
  - `x-[api/event]-service-control`: enable or disable service fallen control using hystrix circuit breaker
  - `x-[api/event]-service-validation`: validate request parameters using swagger validator
  - `x-[api/event]-service-passthrough`: passthrough original request from API Gateway to service model for backward compatibility
  - `method`: define a Rest API method: (get/put/post/delete)
    - `operationId`: to define a friendly name for this operation method: e.g getPetByName
    - `x-control-service-timeout`: setup circuit break operation timeout
    - `x-control-service-duration`: setup circuit break operation close duration
    - `x-control-service-threshold`: setup circuit break operation threshold

[![](https://mermaid.ink/img/eyJjb2RlIjoic3RhdGVEaWFncmFtXG5cdFsqXSAtLT4gYXBpR2F0ZXdheVxuICBhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZXRzOiAvbWljcm9TZXJ2aWNlRm9yUGV0c1xuXHRhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZW9wbGU6IC9taWNyb1NlcnZpY2VGb3JQZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGV0cyAtLT4gUGF0aEVycm9yczogL3Vua25vd25cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBQYXRoRXJyb3JzOiAvdW5rbm93blxuXG5cdG1pY3JvU2VydmljZUZvclBldHMgLS0-IGxpbmtQZXRUb1BlcnNvbjogL3BldHMve2lkfVxuICBtaWNyb1NlcnZpY2VGb3JQZXRzIC0tPiBjcmVhdGVQZXQ6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IGdldFBldHM6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IHVwZGF0ZVBldEJ5SWQ6IC9wZXRzL3tpZH0gKCoqcHJvdGVjdGVkKiopXG5cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBjcmVhdGVQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBnZXRQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBwdXRQZW9wbGU6IC9wZW9wbGVcbiAgXG4gIGNyZWF0ZVBldCAtLT4gUGV0c1xuICBnZXRQZXRzIC0tPiBQZXRzXG4gIHVwZGF0ZVBldEJ5SWQgLS0-IFBlb3BsZVBldHNcbiAgY3JlYXRlUGVvcGxlIC0tPiBQZW9wbGVQZXRzXG5cbiAgbGlua1BldFRvUGVyc29uIC0tPiBQZW9wbGVQZXRzXG4gIGdldFBlb3BsZSAtLT4gUGVvcGxlUGV0cyAgXG5cblx0UGF0aEVycm9ycyAtLT4gWypdXG4gIFBlb3BsZVBldHMgLS0-IFsqXVxuICBQZXRzIC0tPiBbKl1cblx0XHRcdFx0XHQiLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)](https://mermaid-js.github.io/mermaid-live-editor/#/edit/eyJjb2RlIjoic3RhdGVEaWFncmFtXG5cdFsqXSAtLT4gYXBpR2F0ZXdheVxuICBhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZXRzOiAvbWljcm9TZXJ2aWNlRm9yUGV0c1xuXHRhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZW9wbGU6IC9taWNyb1NlcnZpY2VGb3JQZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGV0cyAtLT4gUGF0aEVycm9yczogL3Vua25vd25cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBQYXRoRXJyb3JzOiAvdW5rbm93blxuXG5cdG1pY3JvU2VydmljZUZvclBldHMgLS0-IGxpbmtQZXRUb1BlcnNvbjogL3BldHMve2lkfVxuICBtaWNyb1NlcnZpY2VGb3JQZXRzIC0tPiBjcmVhdGVQZXQ6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IGdldFBldHM6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IHVwZGF0ZVBldEJ5SWQ6IC9wZXRzL3tpZH0gKCoqcHJvdGVjdGVkKiopXG5cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBjcmVhdGVQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBnZXRQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBwdXRQZW9wbGU6IC9wZW9wbGVcbiAgXG4gIGNyZWF0ZVBldCAtLT4gUGV0c1xuICBnZXRQZXRzIC0tPiBQZXRzXG4gIHVwZGF0ZVBldEJ5SWQgLS0-IFBlb3BsZVBldHNcbiAgY3JlYXRlUGVvcGxlIC0tPiBQZW9wbGVQZXRzXG5cbiAgbGlua1BldFRvUGVyc29uIC0tPiBQZW9wbGVQZXRzXG4gIGdldFBlb3BsZSAtLT4gUGVvcGxlUGV0cyAgXG5cblx0UGF0aEVycm9ycyAtLT4gWypdXG4gIFBlb3BsZVBldHMgLS0-IFsqXVxuICBQZXRzIC0tPiBbKl1cblx0XHRcdFx0XHQiLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)

```yaml
openapi: 3.0.0
info:
  version: 0.0.1
  title: The pet project with serverless pattern
x-project-name: project-pets
x-deployment-name: project-pets-demo
x-deployment-region: eu-west-1
x-deployment-profile: simplify-eu
x-api-gateway-name: api-gateway-restapi-name
x-api-authorizer-id: eu-west-1_g4zb3L3Iu
#x-api-hystrix-dashboard: false
paths:
  '/event-for-pets':
    x-event-service-key-vault: true
    x-event-service-name: event-service-for-pets
    #x-event-service-custom: arn:aws:lambda:eu-west-1:xxxxxxxxxxxx:function:lambda-custom-resource
    #x-event-service-policy: arn:aws:iam::xxxxxxxxxxxx:policy/External-DynamoDB-Read-IAMPolicy
    x-event-service-schedule: rate(10 minutes)
    x-event-service-path: true
    put:
      description: 'Run on event operation'
      responses:
        '200':
          description: Success
  '/pets':
    x-api-service-path: true
    x-api-service-name: api-service-for-pets
    x-api-service-authorizer: true
    x-api-service-api-key: true
    x-api-service-tag: devel
    get:
      tags:
        - Pets Service Group
      description: 'Get Pets Information'
      operationId: getPets
      parameters:
      - name: cats
        in: query        
        schema:
          type: string
        required: false
      responses:
        '200':
          description: Success
    post:
      tags:
        - Pets Service Group
      description: 'Create Pets Information'
      operationId: createPet
      requestBody:
        description: Optional description in *Markdown*
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                dataObject:
                  type: object
      responses:
        '200':
          description: Success
    put:
      tags:
        - Pets Service Group
      description: 'Update Pets Information'
      operationId: updatePetWithFields
      requestBody:
        description: Optional description in *Markdown*
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                dataObject:
                  type: object
      responses:
        '200':
          description: Success
  '/pets/{id}':
    x-api-service-path: true
    x-api-service-authorizer: true
    x-api-service-api-key: false
    x-api-service-name: api-service-for-pets
    x-api-service-model-name: people-pets
    x-api-service-control: true
    post:
      x-control-service-timeout: 60000
      x-control-service-duration: 30000
      x-control-service-threshold: 0.1
      tags:
        - Pets Service Group
      description: 'Create Pets Information By Id'
      operationId: linkPetToPerson
      parameters:
      - in: path
        name: id
        required: true
        schema:
            type: string
      - in: query
        name: filter        
        schema:
            type: string    
      requestBody:
        description: Optional description in *Markdown*
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                foo:
                  type: string
      responses:
        '200':
          description: Success
  '/people':
    x-api-service-name: api-service-for-people
    x-api-service-model-name: people-pets
    get:
      tags:
        - People Service Group
      description: 'Get People Information'
      operationId: getPeople
      responses:
        '200':
          description: Success
    put:
      tags:
        - People Service Group
      description: 'Update People Information'
      operationId: putPeople
      responses:
        '200':
          description: Success
    post:
      tags:
        - People Service Group
      description: 'Create People Information By Id'
      operationId: createPeople
      responses:
        '200':
          description: Success
servers:
  - url: /
```

## Generate project code by using command line:

`simplify-codegen generate -i spec.yaml -o ../output/functions`

