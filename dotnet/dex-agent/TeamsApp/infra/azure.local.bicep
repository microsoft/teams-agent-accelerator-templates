@maxLength(20)
@minLength(4)
@description('Used to generate names for all resources in this file')
param resourceBaseName string

@description('Required when create Azure Bot service')
param botAadAppClientId string

@description('Required to setup connection to GitHub')
param githubClientId string

@secure()
param githubClientSecret string

@maxLength(42)
param botDisplayName string

param botAppDomain string
param tenantId string
param oauthConnectionName string

module azureBotRegistration './botRegistration/azurebot.bicep' = {
  name: 'Azure-Bot-registration'
  params: {
    resourceBaseName: resourceBaseName
    botAadAppClientId: botAadAppClientId
    botAppDomain: botAppDomain
    botDisplayName: botDisplayName
    tenantId: tenantId
    oauthConnectionName: oauthConnectionName
    githubClientId: githubClientId
    githubClientSecret: githubClientSecret
  }
}
