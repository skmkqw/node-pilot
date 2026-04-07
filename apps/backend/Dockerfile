FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/NodePilot.Application/NodePilot.Application.csproj src/NodePilot.Application/
COPY src/NodePilot.Api/NodePilot.Api.csproj src/NodePilot.Api/
RUN dotnet restore src/NodePilot.Api/NodePilot.Api.csproj

COPY src/ src/
RUN dotnet publish src/NodePilot.Api/NodePilot.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail http://127.0.0.1:8080/health || exit 1

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "NodePilot.Api.dll"]
