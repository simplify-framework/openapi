# Simplify Framework - CodeGen
  
![Devops CI/CD](https://github.com/simplify-framework/codegen/workflows/DevOps%20CI/CD/badge.svg)
![NPM Downloads](https://img.shields.io/npm/dw/codegen)
![Package Version](https://img.shields.io/github/package-json/v/simplify-framework/codegen?color=green)
![Coverity Scan](https://scan.coverity.com/projects/21173/badge.svg)

Initial code based on [openapi-codegen](https://github.com/Mermade/openapi-codegen)

*Node.js-based codegen for OpenAPI specs. This project was initially by tailoring from openapi-codegen to use the core code generation functionality to generate the lambda based node projects and AWS CloudFormation stack. There was many tailored code to become a powerful tool nowaday. Thanks to the initial openapi-codegen project that has saved time for developing an initial idea.*

## Divided code capability:
- `Nano` function: per individual method (/path/rc: GET) as a lambda function
- `Micro` function: per some methods (/path/ac: POST, PUT) as a lambda function
- `Kilo` function: per some resources (/path/rc, /path/ac) as a lambda function
- `Mono` application: as an application running on a docker-compose service

## Deployment mode capability:
- BlueGreen deployment: run `latest` version as `Blue` stage or `stable` version as `Green` stage
- Enforcement deployment: specify to run a custom enforcement version (e.g maintenance package mode)
- Canary deployment: run one of [`latest`,`stable`,`enforce`] version on-request by `x-canary-selection` HTTP header

## Software development facility:
- Production ready code skeleton (sanitizer, unit tests, api tests, coverage)
- Controllable logging verbosity (INFO, WARN, DEBUG, ERROR) using `debug` package
- Local and independant development code run (http://localhost:3000) by node `express`

## Install from published NPM packages
- `npm install -g simplify-codegen`

## Install codegen from github sourcode, link to dependancy system
- `git clone https://github.com/simplify-framework/codegen.git`
- `cd codegen && npm install && npm link`

## Generate Open API specs sample for pets:
- `mkdir pets-project` to create project folder for pets
- `cd pets-project && npm link simplify-codegen` if you install from github
- `simplify-codegen template -i petsample` to create a `petsample` OpenAPI 3.0 specs
- `simplify-codegen template -i othername` to create a `othername` OpenAPI 3.0 specs

## Generate project using command line:
- `simplify-codegen generate -i openapi.yaml` to generate code in the current folder
- `simplify-codegen generate -i openapi.yaml -o other-folder` to specify another folder

## Setup AWS configuration profile
- Create a deployment user in IAM: `simplify-user`
- Setup IAM Role Policy using: `policy-deployment.json`
- Setup IAM Role Policy using: `policy-execute-api.json`
- Configure your machine `aws configure --profile simplify-eu`

## You are in the pets project directory
- `npm install` to install project dependancies and tools
- `npm run stack-deploy` to provision code containers (AWS Lambda empty functions)
- `npm run push-code` to deploy and run code as declared in .env variables (ENV_*)
  + ENV_functionName_DEPLOYMENT_STAGE=(`latest`|`stable`|`enfoce`|`canary`) to setup running mode
  + ENV_functionName_ENFORCEMENT_PACKAGE=specific-package-name-with-version (`enforce` mode only)
- `npm run stack-destroy` to provision code containers (AWS Lambda empty functions)

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

## OpenAPI specs with Simplify definitions:
- `info.version`: define software package version, set for initial packages
- `info.title`: define software package description, set for initial packages
- `x-project-name`: to define a project which contains other resources (e.g `pets-micro-services`)
- `x-deployment-name`: to define a deployment environment (e.g `pets-demo`, `pets-prod`)
- `x-deployment-region`: to define where to deploy resources (e.g `eu-west-1`)
- `x-deployment-profile`: to define a profile that hold the deployment access (e.g `simplify-eu`)
- `x-api-gateway-name`: to define an API gateway (Rest API) resource (e.g `pets-api-gateway`)
- `x-api-authorizer-id`: provide an authorizer id that linked to API Authorizer (e.g Cognito Auhtorizer)
- `x-api-burst-limit`: The API request burst limit, the maximum rate limit over a time ranging from one to a few seconds
- `x-api-rate-limit`: The API request steady-state rate limit.
- `x-api-quota-limit`: The maximum number of requests that can be made in a given time period.
- `x-api-quota-unit`: The time period in which the limit applies. Valid values are "DAY", "WEEK" or "MONTH".
  - `x-[api/event]-service-runtime`: specify service runtime to create function (e.g nodejs12.x, python3.8 )
  - `x-[api/event]-service-lang`: specific runtime language - is one of `javascript` or `python`
  - `x-[api/event]-service-name`: to define lambda functions that host the source code (e.g `pets-service`)
  - `x-[api/event]-service-model-name`: to redirect the related routing paths into a service group (e.g `pets`)
  - `x-[api/event]-service-public`: expose or dispose this service path through API gateway (public or not)
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
    - `x-control-operation-id` or standard `operationId`: to define a friendly name for this operation method: e.g getPetByName
    - `x-control-service-timeout`: setup circuit break operation timeout (valid only for docker)
    - `x-control-service-duration`: setup circuit break operation close duration (valid only for docker)
    - `x-control-service-threshold`: setup circuit break operation threshold (valid only for docker)

## The generated Pets Architecture Diagram

![PetsDiagram](https://mermaid.ink/img/eyJjb2RlIjoic3RhdGVEaWFncmFtXG4gIFsqXSAtLT4gYXBpR2F0ZXdheVJlc3RhcGlOYW1lXG4gICAgYXBpR2F0ZXdheVJlc3RhcGlOYW1lIC0tPiBmdW5jdGlvbkZvckJ1eVBldHNcbiAgICBhcGlHYXRld2F5UmVzdGFwaU5hbWUgLS0-IGZ1bmN0aW9uRm9yRXRyYW5nZXJQZXRzXG4gICAgYXBpR2F0ZXdheVJlc3RhcGlOYW1lIC0tPiBmdW5jdGlvbkZvclBldHNcbiAgICBhcGlHYXRld2F5UmVzdGFwaU5hbWUgLS0-IGZ1bmN0aW9uRm9yUGVvcGxlXG5cbiAgICBmdW5jdGlvbkZvckJ1eVBldHM6ICBTaWd2NCBJQU1cbiAgICBmdW5jdGlvbkZvckV0cmFuZ2VyUGV0czogIFNpZ3Y0IElBTVxuICAgIGZ1bmN0aW9uRm9yUGV0czogIFNpZ3Y0IElBTVxuICAgIGZ1bmN0aW9uRm9yUGVvcGxlOiAgU2lndjQgSUFNXG5cbiAgICBmdW5jdGlvbkZvckJ1eVBldHMgLS0-IGdldFNob3BwaW5nUGV0czogR0VUIC9zaG9wcGluZy9wZXRzXG4gICAgZnVuY3Rpb25Gb3JFdHJhbmdlclBldHMgLS0-IGdldEV0cmFuZ2VyUGV0czogR0VUIC9ldHJhbmdlci9wZXRzXG4gICAgZXZlbnRGdW5jdGlvbkZvclBldHMgLS0-IHB1dEV2ZW50c0ZlZWRQZXRzOiBQVVQgL2V2ZW50cy9mZWVkLXBldHNcbiAgICBldmVudEZ1bmN0aW9uRm9yUGV0cyAtLT4gZXZlbnRGdW5jdGlvbkZvclBldHM6IHNjaGVkdWxlZCBieSByYXRlKDEwIGRheXMpXG4gICAgZnVuY3Rpb25Gb3JQZXRzIC0tPiBnZXRQZXRzOiBHRVQgL3BldHNcbiAgICBmdW5jdGlvbkZvclBldHMgLS0-IGNyZWF0ZVBldDogUE9TVCAvcGV0c1xuICAgIGZ1bmN0aW9uRm9yUGV0cyAtLT4gdXBkYXRlUGV0OiBQVVQgL3BldHNcbiAgICBmdW5jdGlvbkZvclBldHMgLS0-IGZlZWRQZXRCeUlkOiBHRVQgL3BldHMve2lkfS9mZWVkL3tjb3VudH1cbiAgICBmdW5jdGlvbkZvclBlb3BsZSAtLT4gbGlua1BldFRvUGVyc29uOiBQT1NUIC9wZW9wbGUvcGV0cy97aWR9XG4gICAgZnVuY3Rpb25Gb3JQZW9wbGUgLS0-IGdldFBlb3BsZTogR0VUIC9wZW9wbGVcbiAgICBmdW5jdGlvbkZvclBlb3BsZSAtLT4gcHV0UGVvcGxlOiBQVVQgL3Blb3BsZVxuICAgIGZ1bmN0aW9uRm9yUGVvcGxlIC0tPiBjcmVhdGVQZW9wbGU6IFBPU1QgL3Blb3BsZVxuICAgIFxuICAgIGdldFNob3BwaW5nUGV0cyAtLT4gc2hvcHBpbmdQZXRzXG4gICAgZ2V0RXRyYW5nZXJQZXRzIC0tPiBldHJhbmdlclBldHNcbiAgICBwdXRFdmVudHNGZWVkUGV0cyAtLT4gZXZlbnRzRmVlZFBldHNcbiAgICBnZXRQZXRzIC0tPiBwZXRzXG4gICAgY3JlYXRlUGV0IC0tPiBwZXRzXG4gICAgdXBkYXRlUGV0IC0tPiBwZXRzXG4gICAgZmVlZFBldEJ5SWQgLS0-IHBldHNGb29kc1xuICAgIGxpbmtQZXRUb1BlcnNvbiAtLT4gcGVvcGxlUGV0c1xuICAgIGdldFBlb3BsZSAtLT4gcGVvcGxlXG4gICAgcHV0UGVvcGxlIC0tPiBwZW9wbGVcbiAgICBjcmVhdGVQZW9wbGUgLS0-IHBlb3BsZVxuIiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQifSwidXBkYXRlRWRpdG9yIjpmYWxzZX0)


