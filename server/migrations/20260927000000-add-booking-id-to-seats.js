'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('seats', 'booking_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'bookings',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addIndex('seats', ['booking_id'], {
      name: 'seats_booking_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('seats', 'seats_booking_id_idx');
    await queryInterface.removeColumn('seats', 'booking_id');
  },
};
