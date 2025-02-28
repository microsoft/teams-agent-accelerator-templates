@maxLength(20)
@minLength(4)
@description('Used to generate names for all resources in this file')
param resourceBaseName string

@description('Required when create Azure Bot service')
param botAadAppClientId string

@secure()
@description('Required by Bot Framework package in your bot project')
param botAadAppClientSecret string

@secure()
param azureOpenAIApiKey string

param azureOpenAIApiBase string
param azureOpenAIApiVersion string

param webAppSKU string

@maxLength(42)
param botDisplayName string

param serverfarmsName string = resourceBaseName
param webAppName string = resourceBaseName
param location string = resourceGroup().location

// Compute resources for your Web App
resource serverfarm 'Microsoft.Web/serverfarms@2021-02-01' = {
  kind: 'linux'
  location: location
  name: serverfarmsName
  properties: {
    reserved: true
  }
  sku: {
    name: webAppSKU
  }
}

// Web App that hosts your bot
resource webApp 'Microsoft.Web/sites@2021-02-01' = {
  kind: 'app,linux'
  location: location
  name: webAppName
  properties: {
    serverFarmId: serverfarm.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'RUNNING_ON_AZURE'
          value: '1'
        }
        {
          name: 'BOT_ID'
          value: botAadAppClientId
        }
        {
          name: 'BOT_PASSWORD'
          value: botAadAppClientSecret
        }
        {
          name: 'AZURE_OPENAI_API_KEY'
          value: azureOpenAIApiKey
        }
        {
          name: 'AZURE_OPENAI_API_BASE'
          value: azureOpenAIApiBase
        }
        {
          name: 'AZURE_OPENAI_API_VERSION'
          value: azureOpenAIApiVersion
        }
        {
          name: 'ENVIRONMENT'
          value: 'prod'
        }
      ]
      ftpsState: 'FtpsOnly'
    }
  }
}

// Register your web service as a bot with the Bot Framework
module azureBotRegistration './botRegistration/azurebot.bicep' = {
  name: 'Azure-Bot-registration'
  params: {
    resourceBaseName: resourceBaseName
    botAadAppClientId: botAadAppClientId
    botAppDomain: webApp.properties.defaultHostName
    botDisplayName: botDisplayName
  }
}

// The output will be persisted in .env.{envName}. Visit https://aka.ms/teamsfx-actions/arm-deploy for more details.
output BOT_AZURE_APP_SERVICE_RESOURCE_ID string = webApp.id
output BOT_DOMAIN string = webApp.properties.defaultHostName
