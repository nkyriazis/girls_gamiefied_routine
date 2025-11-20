import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // --- 1. Tasks Library ---
  const tBrush = await prisma.task.create({ data: { id: 't-brush', title: 'Πλύσιμο Δοντιών', icon: '🪥' } });
  const tWash = await prisma.task.create({ data: { id: 't-wash', title: 'Πλύσιμο Προσώπου', icon: '🧼' } });
  const tDress = await prisma.task.create({ data: { id: 't-dress', title: 'Ντύσιμο', icon: '👗' } });
  const tBreakfast = await prisma.task.create({ data: { id: 't-breakfast', title: 'Πρωινό', icon: '🥞' } });
  const tPajamas = await prisma.task.create({ data: { id: 't-pajamas', title: 'Πιτζάμες', icon: '👚' } });
  const tStory = await prisma.task.create({ data: { id: 't-story', title: 'Παραμύθι', icon: '📖' } });

  // --- 2. Routine Definitions ---
  
  // Morning Routine
  const rMorning = await prisma.routine.create({
    data: {
      id: 'r-morning',
      title: 'Πρωινή Ρουτίνα',
      themeColor: 'var(--color-primary)',
      icon: '☀️',
      tasks: {
        create: [
          { taskId: tBrush.id, order: 1, durationSeconds: 120 },
          { taskId: tWash.id, order: 2, durationSeconds: 60 },
          { taskId: tDress.id, order: 3, durationSeconds: 300 },
          { taskId: tBreakfast.id, order: 4, durationSeconds: 600 },
        ]
      }
    }
  });

  // Evening Routine
  const rEvening = await prisma.routine.create({
    data: {
      id: 'r-evening',
      title: 'Βραδινή Ρουτίνα',
      themeColor: 'var(--color-secondary)',
      icon: '🌙',
      tasks: {
        create: [
          { taskId: tPajamas.id, order: 1, durationSeconds: 180 },
          { taskId: tBrush.id, order: 2, durationSeconds: 120 }, // Reusing Brush task!
          { taskId: tStory.id, order: 3, durationSeconds: 600 },
        ]
      }
    }
  });

  // --- 3. Users & Assignments ---

  // User 1: Electra
  const u1 = await prisma.user.upsert({
    where: { id: 'u1' },
    update: {},
    create: {
      id: 'u1',
      name: 'Ηλέκτρα',
      avatar: '🦄',
      color: 'var(--color-accent)',
      stars: 1250,
      assignments: {
        create: [
          { id: 'u1-assign-morning', routineId: rMorning.id, scheduleTime: '07:00' },
          { id: 'u1-assign-evening', routineId: rEvening.id, scheduleTime: '20:00' }
        ]
      }
    },
  });

  // User 2: Iphigenia
  const u2 = await prisma.user.upsert({
    where: { id: 'u2' },
    update: {},
    create: {
      id: 'u2',
      name: 'Ιφιγένεια',
      avatar: '🦊',
      color: 'var(--color-secondary)',
      stars: 850,
      assignments: {
        create: [
          { id: 'u2-assign-morning', routineId: rMorning.id, scheduleTime: '07:30' }
        ]
      }
    },
  });

  // --- 4. Flows ---
  
  const flowSteps = [
    {
      type: 'alarm',
      props: { sound: 'melody' }
    },
    {
      type: 'parallel',
      actions: [
        // Using Assignment IDs as routineId for the frontend to match
        { type: 'routine', userId: 'u1', routineId: 'u1-assign-morning' }, 
        { type: 'routine', userId: 'u2', routineId: 'u2-assign-morning' }
      ]
    }
  ];

  const flow = await prisma.flow.upsert({
    where: { id: 'morning-flow' },
    update: {
        steps: JSON.stringify(flowSteps)
    },
    create: {
      id: 'morning-flow',
      triggerTime: '07:00',
      steps: JSON.stringify(flowSteps),
    },
  });

  console.log('Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
