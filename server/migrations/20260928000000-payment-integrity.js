'use strict';

/**
 * Payment integrity:
 *  - payments carry their owner, event and a snapshot of the seats/prices they paid for, so a
 *    receipt (or a refund notice) still works after the hold rows are gone.
 *  - at most ONE live payment (PENDING or SUCCESS) per hold: the database, not the app code,
 *    stops a hold from being charged twice.
 *  - at most one booking per hold.
 *  - attempts / failure_reason let a declined payment be retried with the SAME idempotency key.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('payments', 'user_id', {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE',
      }, { transaction });
      await queryInterface.addColumn('payments', 'event_id', {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'events', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE',
      }, { transaction });
      await queryInterface.addColumn('payments', 'seat_snapshot', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      await queryInterface.addColumn('payments', 'attempts', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 }, { transaction });
      await queryInterface.addColumn('payments', 'failure_reason', { type: Sequelize.STRING(255), allowNull: true }, { transaction });

      await queryInterface.addIndex('payments', ['user_id'], { name: 'payments_user_id_idx', transaction });
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX payments_one_live_per_hold ON payments (hold_group_id)
         WHERE status IN ('PENDING', 'SUCCESS');`,
        { transaction }
      );

      await queryInterface.removeIndex('bookings', 'bookings_hold_group_id_idx', { transaction });
      await queryInterface.addIndex('bookings', ['hold_group_id'], { name: 'bookings_hold_group_id_unique', unique: true, transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('bookings', 'bookings_hold_group_id_unique', { transaction });
      await queryInterface.addIndex('bookings', ['hold_group_id'], { name: 'bookings_hold_group_id_idx', transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS payments_one_live_per_hold;', { transaction });
      await queryInterface.removeIndex('payments', 'payments_user_id_idx', { transaction });
      for (const col of ['failure_reason', 'attempts', 'seat_snapshot', 'event_id', 'user_id']) {
        await queryInterface.removeColumn('payments', col, { transaction });
      }
    });
  },
};
