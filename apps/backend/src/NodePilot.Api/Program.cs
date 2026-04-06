using NodePilot.Api;
using NodePilot.Application;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApplication()
    .AddPresentation();

var app = builder.Build();

app.MapControllers();

app.MapGet("/", () => "OK");

app.Run();
