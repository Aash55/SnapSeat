'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      booking_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'bookings',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      hold_group_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      idempotency_key: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUND_PENDING'),
        allowNull: false,
        defaultValue: 'PENDING'
      },
      gateway_payment_id: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addIndex('payments', ['hold_group_id'], {
      name: 'payments_hold_group_id_idx'
    });

    await queryInterface.addIndex('payments', ['booking_id'], {
      name: 'payments_booking_id_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_status";');
  }
};
