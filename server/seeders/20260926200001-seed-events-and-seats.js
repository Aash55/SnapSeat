'use strict';

// Demo events with dates relative to "now", so the seed never goes stale.
// Each category becomes one lettered row block; the seat map lays seats out 16 to a row.
const DAY = 86400000;
const at = (days, hour, minute) => {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hour - 5, minute - 30, 0, 0); // hour:minute in India time (UTC+5:30)
  return d;
};

const EVENTS = [
  { title: 'Midnight Jazz Sessions', category: 'Concert', city: 'Mumbai', venue: 'The Blue Room, Riverside Arena', date: at(7, 21, 0),
    description: 'Late-night jazz with a live trio.', cats: [['VIP', 1500, 16], ['Gold', 900, 32], ['Standard', 600, 48]] },
  { title: 'Hostel Diaries: A Stand-up Hour', category: 'Comedy', city: 'Delhi', venue: 'Studio Black Box, Sector 4', date: at(12, 20, 0),
    description: 'An hour of new stand-up material.', cats: [['Front Row', 800, 16], ['Standard', 400, 48]] },
  { title: 'Symphony Under the Stars', category: 'Concert', city: 'Pune', venue: 'Open Lawn, Heritage Grounds', date: at(14, 18, 45),
    description: 'An open-air evening with the city orchestra.', cats: [['VIP', 1500, 32], ['Standard', 600, 64]] },
  { title: 'Grandmasters Live: Blitz Showdown', category: 'Sports', city: 'Chennai', venue: 'Convention Hall B, City Centre', date: at(21, 17, 0),
    description: 'Eight grandmasters, three-minute games, live commentary.', cats: [['Ringside', 1200, 16], ['Gallery', 500, 48]] },
  { title: 'The Last Monsoon — Stage Premiere', category: 'Theatre', city: 'Bengaluru', venue: 'Ranga Shankara Main Stage', date: at(28, 19, 30),
    description: 'Premiere night of a new two-act play.', cats: [['Stalls', 1000, 32], ['Balcony', 450, 32]] },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [[organizer]] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'organizer@snapseat.com' LIMIT 1;`
    );
    const now = new Date();
    const letters = 'ABCDEFGHIJ';

    for (const ev of EVENTS) {
      const [[event]] = await queryInterface.sequelize.query(
        `INSERT INTO events (organizer_id, title, category, city, venue, date, description, created_at, updated_at)
         VALUES (:org, :title, :category, :city, :venue, :date, :description, :now, :now) RETURNING id`,
        { replacements: { org: organizer.id, ...ev, now } }
      );
      for (let i = 0; i < ev.cats.length; i++) {
        const [name, price, count] = ev.cats[i];
        const [[cat]] = await queryInterface.sequelize.query(
          `INSERT INTO seat_categories (event_id, name, price, created_at, updated_at)
           VALUES (:eventId, :name, :price, :now, :now) RETURNING id`,
          { replacements: { eventId: event.id, name, price, now } }
        );
        const seats = [];
        for (let n = 1; n <= count; n++) {
          seats.push({ event_id: event.id, category_id: cat.id, seat_number: `${letters[i]}${n}`, status: 'free', created_at: now, updated_at: now });
        }
        await queryInterface.bulkInsert('seats', seats);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('events', { title: EVENTS.map((e) => e.title) }, {});
  },
};
