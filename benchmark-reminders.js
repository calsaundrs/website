const EventEmitter = require('events');

// Mocking the dependencies
class MockEmailService {
  async sendEventReminder(email, name, date, url) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true, messageId: 'mock-id' };
  }
}

const mockEvents = Array.from({ length: 20 }, (_, i) => ({
  id: `event-${i}`,
  data: () => ({
    name: `Event ${i}`,
    submittedBy: `promoter${i}@example.com`,
    slug: `event-${i}`,
    eventDate: '2023-12-25',
    eventTime: '19:00'
  })
}));

const mockSnapshot = {
  docs: mockEvents,
  size: mockEvents.length,
  empty: false
};

async function sequentialImplementation(eventsSnapshot, emailService) {
  const results = [];
  const start = Date.now();

  for (const doc of eventsSnapshot.docs) {
    const eventData = doc.data();
    const promoterEmail = eventData.submittedBy || eventData.submitterEmail;

    try {
      const eventUrl = `https://brumoutloud.co.uk/event/${eventData.slug}`;
      const eventDate = `${eventData.eventDate} at ${eventData.eventTime || 'TBD'}`;

      const emailResult = await emailService.sendEventReminder(
        promoterEmail,
        eventData.name,
        eventDate,
        eventUrl
      );

      if (emailResult.success) {
        results.push({ status: 'sent' });
      }
    } catch (error) {
      results.push({ status: 'error' });
    }
  }

  const end = Date.now();
  return end - start;
}

async function parallelImplementation(eventsSnapshot, emailService) {
  const start = Date.now();

  const promises = eventsSnapshot.docs.map(async (doc) => {
    const eventData = doc.data();
    const promoterEmail = eventData.submittedBy || eventData.submitterEmail;

    try {
      const eventUrl = `https://brumoutloud.co.uk/event/${eventData.slug}`;
      const eventDate = `${eventData.eventDate} at ${eventData.eventTime || 'TBD'}`;

      const emailResult = await emailService.sendEventReminder(
        promoterEmail,
        eventData.name,
        eventDate,
        eventUrl
      );

      if (emailResult.success) {
        return { status: 'sent' };
      }
    } catch (error) {
      return { status: 'error' };
    }
  });

  const results = await Promise.all(promises);

  const end = Date.now();
  return end - start;
}

async function runBenchmark() {
  const emailService = new MockEmailService();

  console.log(`Running benchmark with ${mockEvents.length} events...`);

  const seqTime = await sequentialImplementation(mockSnapshot, emailService);
  console.log(`Sequential time: ${seqTime}ms`);

  const parTime = await parallelImplementation(mockSnapshot, emailService);
  console.log(`Parallel time: ${parTime}ms`);

  const improvement = ((seqTime - parTime) / seqTime * 100).toFixed(2);
  console.log(`Improvement: ${improvement}%`);
}

runBenchmark();
