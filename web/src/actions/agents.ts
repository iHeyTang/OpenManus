'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/auth-wrapper';
import { prisma } from '@/lib/prisma';

export const createAgent = withUserAuth(
  async ({ organization, args }: AuthWrapperContext<{ name: string; description: string; tools: string[]; llmId: string }>) => {
    const agent = await prisma.agents.create({
      data: { name: args.name, description: args.description, tools: args.tools, organizationId: organization.id, llmId: args.llmId },
    });
  },
);

export const updateAgent = withUserAuth(
  async ({ organization, args }: AuthWrapperContext<{ id: string; name: string; description: string; tools: string[]; llmId: string }>) => {
    const agent = await prisma.agents.update({
      where: { id: args.id, organizationId: organization.id },
      data: { name: args.name, description: args.description, tools: args.tools, llmId: args.llmId },
    });
  },
);

export const deleteAgent = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ id: string }>) => {
  const agent = await prisma.agents.delete({ where: { id: args.id, organizationId: organization.id } });
});

export const listAgents = withUserAuth(async ({ organization }: AuthWrapperContext<{}>) => {
  const agents = await prisma.agents.findMany({ where: { organizationId: organization.id } });
  return agents;
});
