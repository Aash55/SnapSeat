'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('seats', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      event_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'events',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'seat_categories',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      seat_number: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('free', 'held', 'booked'),
        allowNull: false,
        defaultValue: 'free'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    await queryInterface.addIndex('seats', ['event_id', 'seat_number'], {
      unique: true,
      name: 'seats_event_id_seat_number_unique'
    });

    await queryInterface.addIndex('seats', ['event_id', 'status'], {
      name: 'seats_event_id_status_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('seats');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_seats_status";');
  }
};
