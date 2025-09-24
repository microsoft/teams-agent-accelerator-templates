using DexAgent.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;

namespace DexAgent.Controllers;

[ApiController]
[Route("api/webhook")]
public class WebhookController : ControllerBase
{
    private readonly IRepositoryService RepositoryService;

    public WebhookController(IRepositoryService repositoryService)
    {
        RepositoryService = repositoryService;
    }

    [HttpPost]
    public async Task PostAsync(CancellationToken cancellationToken)
    {
        string requestBody;
        using (var reader = new StreamReader(Request.Body))
        {
            requestBody = await reader.ReadToEndAsync();
        }

        var payload = JsonConvert.DeserializeObject<dynamic>(requestBody);

        await RepositoryService.HandleWebhook(payload, Request, Response, cancellationToken);
    }

}
