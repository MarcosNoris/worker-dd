import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  CaseAiGenerationWorkerCommand,
  CaseAiGenerationWorkerService,
} from './case-ai-generation-worker.service';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const command = readCommand();
  const app = await NestFactory.createApplicationContext(WorkerModule);

  try {
    await app.get(CaseAiGenerationWorkerService).run(command);
  } finally {
    await app.close();
  }
}

bootstrap().catch((error: unknown) => {
  console.error(readErrorMessage(error));
  process.exitCode = 1;
});

function readCommand(): CaseAiGenerationWorkerCommand {
  const command = process.argv[2];

  if (command === 'create-case' || command === 'recover-cases') {
    return command;
  }

  throw new Error('Usage: node dist/main <create-case|recover-cases>');
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown worker error.';
}
