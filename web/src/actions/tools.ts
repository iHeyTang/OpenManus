'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/auth-wrapper';
import { encryptLongTextWithPublicKey } from '@/lib/crypto';
import { prisma } from '@/lib/prisma';
import { to } from '@/lib/to';
import { mcpServerSchema } from '@/lib/tools';
import Ajv from 'ajv';
import fs from 'fs';
import { JSONSchema } from 'json-schema-to-ts';
import path from 'path';
import { z } from 'zod';

const MANUS_URL = process.env.MANUS_URL || 'http://localhost:5172';

const ajv = new Ajv();

export const listAgentTools = withUserAuth(async ({ organization }: AuthWrapperContext<{}>) => {
  // Get system tools
  const systemTools = await fetch(`${MANUS_URL}/tools`)
    .then(res => res.json() as Promise<{ name: string; type: 'tool' | 'mcp'; description: string; parameters: JSONSchema }[]>)
    .then(res => res.map(r => ({ ...r, id: r.name, source: 'BUILT_IN', schema: { id: r.name, name: r.name } })));

  // Get organization custom tools
  const tools = await prisma.agentTools
    .findMany({
      where: {
        organizationId: organization.id,
      },
      include: { schema: { select: { id: true, name: true, description: true } } },
    })
    .then(res =>
      res.map(r => ({
        id: r.id,
        name: r.name || r.schema?.name || r.id,
        type: 'mcp',
        description: r.schema?.description,
        source: r.source,
        schema: {
          id: r.schema?.id,
          name: r.schema?.name,
        },
      })),
    );

  return [...systemTools, ...tools];
});

export const installTool = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ toolId: string; env: Record<string, string> }>) => {
  const publicKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'public.pem'), 'utf8');
  const { toolId, env } = args;
  const tool = await prisma.toolSchemas.findUnique({
    where: { id: toolId },
  });

  if (!tool) {
    throw new Error('Tool not found');
  }

  const validate = ajv.compile(tool.envSchema);
  const isValid = validate(env);

  if (!isValid) {
    throw new Error(`Invalid environment variables config: ${JSON.stringify(validate.errors)}`);
  }

  const existing = await prisma.agentTools.findUnique({
    where: { schemaId_organizationId: { schemaId: toolId, organizationId: organization.id } },
  });

  if (existing) {
    await prisma.agentTools.update({
      where: { schemaId_organizationId: { schemaId: toolId, organizationId: organization.id } },
      data: { env: encryptLongTextWithPublicKey(JSON.stringify(env), publicKey) },
    });
  } else {
    await prisma.agentTools.create({
      data: {
        source: 'STANDARD',
        organizationId: organization.id,
        schemaId: toolId,
        env: encryptLongTextWithPublicKey(JSON.stringify(env), publicKey),
      },
    });
  }
});

export const installCustomTool = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ name: string; config: string }>) => {
  const { name, config } = args;
  const [err, json] = await to<z.infer<typeof mcpServerSchema>>(JSON.parse(config));
  if (err) {
    throw new Error('Invalid config, config should be a valid JSON object');
  }

  const validationResult = mcpServerSchema.safeParse(json);
  if (!validationResult.success) {
    throw new Error(`Invalid config: ${validationResult.error.message}`);
  }

  const publicKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'public.pem'), 'utf8');
  await prisma.agentTools.create({
    data: {
      source: 'CUSTOM',
      organizationId: organization.id,
      name,
      customConfig: encryptLongTextWithPublicKey(config, publicKey),
    },
  });

  return { message: 'Tool installed successfully' };
});

export const removeTool = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ toolId: string }>) => {
  const { toolId } = args;
  const tool = await prisma.agentTools.findFirst({
    where: { id: toolId, organizationId: organization.id },
  });

  if (!tool) {
    throw new Error('Tool not found');
  }

  await prisma.agentTools.delete({
    where: { id: toolId, organizationId: organization.id },
  });

  return { message: 'Tool removed successfully' };
});

/**
 * list all ToolSchemas from marketplace
 */
export const listToolSchemas = withUserAuth(async ({}: AuthWrapperContext<{}>) => {
  const tools = await prisma.toolSchemas.findMany({});
  return tools;
});

/**
 * register a new tool
 * only root user can register a new tool
 */
export const registerTool = withUserAuth(
  async ({
    user,
    args: { name, description, repoUrl, command, args, envSchema },
  }: AuthWrapperContext<{ name: string; description: string; repoUrl?: string; command: string; args: string[]; envSchema: JSONSchema }>) => {
    const u = await prisma.users.findUnique({ where: { email: user.email } });
    if (!u) {
      throw new Error('User not found');
    }
    if (u.email !== process.env.ROOT_USER_EMAIL) {
      throw new Error('Unauthorized');
    }

    const tool = await prisma.toolSchemas.findUnique({ where: { name } });

    if (tool) {
      throw new Error('Tool already exists');
    }

    await prisma.toolSchemas.create({
      data: { name, description, repoUrl, command, args, envSchema },
    });

    return { message: 'Tool registered successfully' };
  },
);
