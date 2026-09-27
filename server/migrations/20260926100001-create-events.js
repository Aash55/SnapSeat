'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('events', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      organizer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      category: {
        type: Sequelize.ENUM('Concert', 'Comedy', 'Sports', 'Theatre'),
        allowNull: false
      },
      city: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      venue: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
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

    await queryInterface.addIndex('events', ['organizer_id'], {
      name: 'events_organizer_id_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('events');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_events_category";');
  }
};
