var builder = DistributedApplication.CreateBuilder(args);

builder.AddProject<Projects.AIBot>("aibot");

builder.Build().Run();
