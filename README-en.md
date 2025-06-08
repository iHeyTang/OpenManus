<p align="center">
  <img src="assets/logo.jpg" width="200"/>
</p>

[中文](README.md) | English

# 🎉 iHeyTang OpenManus

Manus is amazing, but OpenManus can realize any creative idea without an invitation code 🛫!

(**Especially when it has an outstanding frontend interaction experience, it's simply fantastic!**)

## Project Vision

1. A versatile AI assistant for general domains, providing the strongest support for super individuals and one-person companies in the AI era
2. Rapid development and validation of specialized domain AI agents, offering the best efficiency platform for vertical AI Agents

## Project Demo

(Yes, it has full process replay capability, allowing you to share an execution process in an almost lossless way)

1. Network search and automatic note-taking in Flomo through MCP
   https://openmanus.iheytang.com/share/tasks/cm9k3hmiv00ezo8011k4008qx

2. Text-to-image generation using MiniMax through MCP, further converting the generated images into video
   https://openmanus.iheytang.com/share/tasks/cmbnaws9y001xqr01e7miwpme

## Project Features

1. Clean and elegant operation interface - Command line? Not here.
2. ~~Multi-organization, multi-user support - This is great, each tenant can configure their own APIKey~~ You can configure multiple LLM APIKeys simultaneously, and you can choose any pre-configured APIKey during conversations!
3. Background task execution - Ask questions, close the page, come back later to see the results
4. ~~Quick MCP integration - Fast installation from MCP marketplace, get started with MCP in 1 minute~~ Custom MCP tool support - You can add your customized MCP tools to your Agent, and these tools will only serve you!
5. Workspace sandbox management - Each user has their own independent sandbox with almost a complete Linux environment, it's like assigning a computer to your Agent. Just imagine the potential when your Agent has its own dedicated computer!
6. Multi-turn conversations - Task not completed well? Keep asking questions

## Installation Guide

The project is divided into two parts: Core (root directory) and App (web/)

### OpenManus Core

1. Install uv (a fast Python package manager):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. Clone the repository:

```bash
git clone https://github.com/iHeyTang/OpenManus.git
cd OpenManus
```

3. Create and activate virtual environment:

```bash
uv venv --python 3.12
source .venv/bin/activate  # Unix/macOS systems
# For Windows systems use:
# .venv\Scripts\activate

# After successful installation, you'll see the following prompt. You can either restart Terminal or follow these instructions:
#To add $HOME/.local/bin to your PATH, either restart your shell or run:
#    source $HOME/.local/bin/env (sh, bash, zsh)
#    source $HOME/.local/bin/env.fish (fish)

# Verify uv installation success
uv --version
# Output the following version number indicates successful installation
# uv 0.6.14 (a4cec56dc 2025-04-09)
```

4. Install dependencies:

````bash
uv pip install -r requirements.txt

### Install browser automation tool playwright
```bash
playwright install
````

5. Install Docker environment, recommended [Docker Desktop](https://www.docker.com/products/docker-desktop/) for Windows, [Orbstack](https://orbstack.dev/download) for MacOS or Linux

### OpenManus App

1. Install `node` environment

   Method 1: [Recommended] Use nvm package manager https://github.com/nvm-sh/nvm
   Method 2: Download from official website https://nodejs.org/en
   Method 3: (Windows systems) Use nvm package manager https://github.com/coreybutler/nvm-windows/releases/tag/1.2.2

```bash
# After installation, verify success with command
node -v
# Output version number indicates successful installation
# v20.19.0
```

2. Enter `web/` folder

```bash
# Ignore if already in web directory
cd web
```

3. Install project dependencies

```bash
# Install project dependencies
npm install
```

4. Generate key pair

The project requires a public-private key pair for authentication, which can be generated with the following command (skip if you can generate certificates yourself):

```bash
npm run generate-keys

# This will generate in the `web/keys` directory:
# - `private.pem`: Private key file
# - `public.pem`: Public key file
```

5. Database initialization

The project uses PostgreSQL as the persistent database. You can use [Docker container](https://hub.docker.com/_/postgres) to start the database service

```bash
# Start docker container and automatically create database named openmanus
docker run --name openmanus-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=openmanus -d -p 5432:5432 postgres
```

6. Environment variable configuration

Create `.env` file in project root directory, configure necessary environment variables, refer to `/web/.env.example`

```bash
# If following step 5 database configuration, the database connection is
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/openmanus?schema=public"
```

7. Generate Prisma Client & Initialize Database

```bash
# If first time starting project, reinstalled dependencies, or schema.prisma has updates, execute this command to update Prisma Client
npx prisma generate

# If first time starting project, need to initialize database, this command will automatically sync table structure into configured database
npx prisma db push
```

## Quick Start

```bash
# OpenManus Core starts with run_api.py
python run_api.py
```

```bash
# OpenManus App needs to enter web/ directory, start with npm run dev
cd web
npm run dev
```

After starting, open `http://localhost:3000` to view

## MCP Tool Configuration

When self-deploying, the Tools Market does not have initialized data. Since the interactive page for adding tools to the marketplace is not fully implemented yet, there are two ways to introduce MCP tools:

1. You can use Custom Tool to manually configure MCP tools in the input configuration dialog.
2. You can refer to `scripts/init_tool_schemas.sql` to directly insert the corresponding data into the database.

## Acknowledgments

This project originated from [OpenManus](https://github.com/mannaandpoem/OpenManus) First Hackathon. Many thanks to OpenManus for providing such a platform that made this project possible!
