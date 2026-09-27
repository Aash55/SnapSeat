'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const passwordHash = await bcrypt.hash('password123', 10);

    await queryInterface.bulkInsert('users', [
      {
        email: 'organizer@snapseat.com',
        password_hash: passwordHash,
        role: 'organizer',
        org_name: 'SnapSeat Events',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        email: 'user1@test.com',
        password_hash: passwordHash,
        role: 'attendee',
        org_name: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        email: 'user2@test.com',
        password_hash: passwordHash,
        role: 'attendee',
        org_name: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {});
  },
};
