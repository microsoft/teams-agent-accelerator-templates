IDistributedApplicationBuilder builder = DistributedApplication.CreateBuilder(args);

builder.AddProject<Projects.OTelBot>("otelbot");

builder.Build().Run();
