'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get the organizer user id
    const [users] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'organizer@snapseat.com' LIMIT 1;`
    );
    const organizerId = users[0].id;

    // Insert 3 events
    await queryInterface.bulkInsert('events', [
      {
        organizer_id: organizerId,
        title: 'Rock Concert 2026',
        category: 'Concert',
        city: 'Mumbai',
        venue: 'Wankhede Stadium',
        date: new Date('2026-12-25T19:00:00.000Z'),
        description: 'Year-end rock show featuring top bands. An unforgettable night of music!',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        organizer_id: organizerId,
        title: 'Stand-Up Night',
        category: 'Comedy',
        city: 'Delhi',
        venue: 'Siri Fort Auditorium',
        date: new Date('2026-11-15T18:30:00.000Z'),
        description: 'A hilarious evening of stand-up comedy with top comedians.',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        organizer_id: organizerId,
        title: 'IPL Final 2027',
        category: 'Sports',
        city: 'Ahmedabad',
        venue: 'Narendra Modi Stadium',
        date: new Date('2027-05-28T19:30:00.000Z'),
        description: 'The grand finale of IPL 2027. Witness cricket history!',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Get event IDs
    const [events] = await queryInterface.sequelize.query(
      `SELECT id, title FROM events ORDER BY id;`
    );

    // Seat categories for each event
    const categories = [];
    for (const event of events) {
      categories.push(
        {
          event_id: event.id,
          name: 'VIP',
          price: 100.00,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          event_id: event.id,
          name: 'Gold',
          price: 60.00,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          event_id: event.id,
          name: 'Silver',
          price: 30.00,
          created_at: new Date(),
          updated_at: new Date(),
        }
      );
    }

    await queryInterface.bulkInsert('seat_categories', categories);

    // Get all category IDs grouped by event
    const [allCategories] = await queryInterface.sequelize.query(
      `SELECT id, event_id, name FROM seat_categories ORDER BY event_id, id;`
    );

    // Generate seats for each category
    const seats = [];
    const categoryLetters = { VIP: 'A', Gold: 'B', Silver: 'C' };
    const categoryCounts = { VIP: 10, Gold: 20, Silver: 20 };

    for (const cat of allCategories) {
      const letter = categoryLetters[cat.name];
      const count = categoryCounts[cat.name];

      for (let i = 1; i <= count; i++) {
        seats.push({
          event_id: cat.event_id,
          category_id: cat.id,
          seat_number: `${letter}${i}`,
          status: 'free',
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    await queryInterface.bulkInsert('seats', seats);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('seats', null, {});
    await queryInterface.bulkDelete('seat_categories', null, {});
    await queryInterface.bulkDelete('events', null, {});
  },
};
