# Simplify CodeGen
  
Based on [openapi-codegen](https://github.com/Mermade/openapi-codegen)

*Node.js-based codegen for OpenAPI documents. This project was initially by tailoring from openapi-codegen to use the core code generation functionality to generate the lambda based node projects and AWS CloudFormation stack.*

```javascript
npm install -g simplify-codegen@latest
```

## Generate project using command line:

`simplify-codegen generate -i openapi.yaml -o ../developments --diff --auto`

## Microservices architecture in AWS:
+ AWS API Gateway REST API
  + AWS Lambda function   (service #1)
    - AWS Secret Manager  (key vault)
    - Custom resource     (external setup)
    - Manage Policy Arn   (access policy)
  + AWS Lambda function   (service #2)
    - AWS Secret Manager  (key vault)
    - Custom resource     (external setup)
    - Manage Policy Arn   (access policy)
  + AWS Lambda function   (service #3)
    - AWS Secret Manager  (key vault)
    - Custom resource     (external setup)
    - Manage Policy Arn   (access policy)

## Setup AWS configuration profile
- Create a deployment user in IAM: `simplify-user`
- Setup IAM Role policy using: `deployment-policy.json`
- Configure your machine `aws configure --profile simplify-eu`

## From your existing spec.yaml, an OpenAPI specs, add extra definitions:
- `info.version`: the software package version, set for initial packages
- `info.title`: the software package description, set for initial packages
- `x-project-name`: to define a project which contains other resources (e.g `pets-micro-services`)
- `x-deployment-name`: to define a deployment environment (e.g `deployment-demo`, `deployment-prod`)
- `x-deployment-region`: to define where to deploy resources (e.g `eu-west-1`)
- `x-deployment-profile`: to define a profile that hold the deployment access (e.g `simplify-eu`)
- `x-api-gateway-name`: to define an API gateway (Rest API) resource (e.g `pets-api-gateway`)
- `x-api-authorizer-id`: provide an authorizer id that linked to API Authorizer (e.g Cognito Auhtorizer)
  - `x-[api/event]-service-runtime`: specify service runtime to create function (e.g nodejs12.x, python3.8 )
  - `x-[api/event]-service-lang`: specific runtime language - is one of `javascript` or `python`
  - `x-[api/event]-service-name`: to define lambda functions that host the source code (e.g `pets-service`)
  - `x-[api/event]-service-model-name`: to redirect the related routing paths into a service group (e.g `pets`)
  - `x-[api/event]-service-path`: expose or dispose this service path through API gateway (public or not)
  - `x-[api/event]-service-authorizer`: enable or disable using API Authorizer (e.g using Cognito Authorizer)
  - `x-[api/event]-service-api-key`: enable to use API Key with `x-api-key` header to authenticate resource
  - `x-[api/event]-service-key-vault`: enable or disable key vault service (SecretManager in AWS)
  - `x-[api/event]-service-schedule`: if set to value (e.g `rate(10 minutes)`) will schedule every 10 mins
  - `x-[api/event]-service-policy`: external access policy ARN (e.g Policy ARN to DynamoDB, S3, SNS...)
  - `x-[api/event]-service-custom`: integrate custom ARN function that trigger for external resource creation/deletion
  - `x-[api/event]-service-control`: enable or disable service fallen control using hystrix circuit breaker (valid only for docker)
  - `x-[api/event]-service-validation`: validate request parameters using swagger request validator (parseRequest middleware)
  - `x-[api/event]-service-passthrough`: passthrough original request from API Gateway to service model for backward compatibility
  - `method`: define a HTTP Rest API method: (get/put/post/delete)
    - `operationId`: to define a friendly name for this operation method: e.g getPetByName
    - `x-control-service-timeout`: setup circuit break operation timeout (valid only for docker)
    - `x-control-service-duration`: setup circuit break operation close duration (valid only for docker)
    - `x-control-service-threshold`: setup circuit break operation threshold (valid only for docker)

[![](https://mermaid.ink/img/eyJjb2RlIjoic3RhdGVEaWFncmFtXG5cdFsqXSAtLT4gYXBpR2F0ZXdheVxuICBhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZXRzOiAvbWljcm9TZXJ2aWNlRm9yUGV0c1xuXHRhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZW9wbGU6IC9taWNyb1NlcnZpY2VGb3JQZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGV0cyAtLT4gUGF0aEVycm9yczogL3Vua25vd25cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBQYXRoRXJyb3JzOiAvdW5rbm93blxuXG5cdG1pY3JvU2VydmljZUZvclBldHMgLS0-IGxpbmtQZXRUb1BlcnNvbjogL3BldHMve2lkfVxuICBtaWNyb1NlcnZpY2VGb3JQZXRzIC0tPiBjcmVhdGVQZXQ6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IGdldFBldHM6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IHVwZGF0ZVBldEJ5SWQ6IC9wZXRzL3tpZH0gKCoqcHJvdGVjdGVkKiopXG5cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBjcmVhdGVQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBnZXRQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBwdXRQZW9wbGU6IC9wZW9wbGVcbiAgXG4gIGNyZWF0ZVBldCAtLT4gUGV0c1xuICBnZXRQZXRzIC0tPiBQZXRzXG4gIHVwZGF0ZVBldEJ5SWQgLS0-IFBlb3BsZVBldHNcbiAgY3JlYXRlUGVvcGxlIC0tPiBQZW9wbGVQZXRzXG5cbiAgbGlua1BldFRvUGVyc29uIC0tPiBQZW9wbGVQZXRzXG4gIGdldFBlb3BsZSAtLT4gUGVvcGxlUGV0cyAgXG5cblx0UGF0aEVycm9ycyAtLT4gWypdXG4gIFBlb3BsZVBldHMgLS0-IFsqXVxuICBQZXRzIC0tPiBbKl1cblx0XHRcdFx0XHQiLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)](https://mermaid-js.github.io/mermaid-live-editor/#/edit/eyJjb2RlIjoic3RhdGVEaWFncmFtXG5cdFsqXSAtLT4gYXBpR2F0ZXdheVxuICBhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZXRzOiAvbWljcm9TZXJ2aWNlRm9yUGV0c1xuXHRhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZW9wbGU6IC9taWNyb1NlcnZpY2VGb3JQZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGV0cyAtLT4gUGF0aEVycm9yczogL3Vua25vd25cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBQYXRoRXJyb3JzOiAvdW5rbm93blxuXG5cdG1pY3JvU2VydmljZUZvclBldHMgLS0-IGxpbmtQZXRUb1BlcnNvbjogL3BldHMve2lkfVxuICBtaWNyb1NlcnZpY2VGb3JQZXRzIC0tPiBjcmVhdGVQZXQ6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IGdldFBldHM6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IHVwZGF0ZVBldEJ5SWQ6IC9wZXRzL3tpZH0gKCoqcHJvdGVjdGVkKiopXG5cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBjcmVhdGVQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBnZXRQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBwdXRQZW9wbGU6IC9wZW9wbGVcbiAgXG4gIGNyZWF0ZVBldCAtLT4gUGV0c1xuICBnZXRQZXRzIC0tPiBQZXRzXG4gIHVwZGF0ZVBldEJ5SWQgLS0-IFBlb3BsZVBldHNcbiAgY3JlYXRlUGVvcGxlIC0tPiBQZW9wbGVQZXRzXG5cbiAgbGlua1BldFRvUGVyc29uIC0tPiBQZW9wbGVQZXRzXG4gIGdldFBlb3BsZSAtLT4gUGVvcGxlUGV0cyAgXG5cblx0UGF0aEVycm9ycyAtLT4gWypdXG4gIFBlb3BsZVBldHMgLS0-IFsqXVxuICBQZXRzIC0tPiBbKl1cblx0XHRcdFx0XHQiLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)


