# Use the official SDK image to build the app
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj files and restore dependencies
COPY ["PadelQ.Api/PadelQ.Api.csproj", "PadelQ.Api/"]
COPY ["PadelQ.Infrastructure/PadelQ.Infrastructure.csproj", "PadelQ.Infrastructure/"]
COPY ["PadelQ.Application/PadelQ.Application.csproj", "PadelQ.Application/"]
COPY ["PadelQ.Domain/PadelQ.Domain.csproj", "PadelQ.Domain/"]

RUN dotnet restore "PadelQ.Api/PadelQ.Api.csproj"

# Copy the rest of the source code
COPY . .
WORKDIR "/src/PadelQ.Api"
RUN dotnet build "PadelQ.Api.csproj" -c Release -o /app/build

# Publish the app
FROM build AS publish
RUN dotnet publish "PadelQ.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Use the runtime image for the final stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
ENV TZ=America/Argentina/Buenos_Aires
RUN sed -i 's/providers = provider_sect/providers = provider_sect\nssl_conf = ssl_sect/g' /etc/ssl/openssl.cnf && \
    printf "\n[ssl_sect]\nsystem_default = system_default_sect\n\n[system_default_sect]\nCipherString = DEFAULT:@SECLEVEL=1\n" >> /etc/ssl/openssl.cnf
WORKDIR /app
COPY --from=publish /app/publish .

# Expose ports
EXPOSE 8080
EXPOSE 8081

ENTRYPOINT ["dotnet", "PadelQ.Api.dll"]
