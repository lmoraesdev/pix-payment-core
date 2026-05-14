import { describe, expect, it } from 'vitest';
import {
  ChargeStateMachine,
  InvalidStateTransitionError,
} from '../../src/modules/charges/domain/charge-state-machine';
import { ChargeStatus } from '../../src/modules/charges/domain/charge-status.enum';

describe('ChargeStateMachine', () => {
  describe('transições válidas', () => {
    it('CREATED → AWAITING_PAYMENT retorna novo status', () => {
      const machine = new ChargeStateMachine(ChargeStatus.CREATED);
      expect(machine.transitionTo(ChargeStatus.AWAITING_PAYMENT)).toBe(
        ChargeStatus.AWAITING_PAYMENT,
      );
    });

    it('AWAITING_PAYMENT → PAID retorna novo status', () => {
      const machine = new ChargeStateMachine(ChargeStatus.AWAITING_PAYMENT);
      expect(machine.transitionTo(ChargeStatus.PAID)).toBe(ChargeStatus.PAID);
    });

    it('AWAITING_PAYMENT → EXPIRED retorna novo status', () => {
      const machine = new ChargeStateMachine(ChargeStatus.AWAITING_PAYMENT);
      expect(machine.transitionTo(ChargeStatus.EXPIRED)).toBe(ChargeStatus.EXPIRED);
    });
  });

  describe('transições inválidas — salto ou regressão de estado', () => {
    it.each([
      [ChargeStatus.CREATED, ChargeStatus.PAID],
      [ChargeStatus.CREATED, ChargeStatus.EXPIRED],
      [ChargeStatus.AWAITING_PAYMENT, ChargeStatus.CREATED],
    ] as const)('%s → %s lança InvalidStateTransitionError', (from, to) => {
      expect(() =>
        new ChargeStateMachine(from).transitionTo(to),
      ).toThrow(InvalidStateTransitionError);
    });
  });

  describe('mensagem de erro carrega contexto', () => {
    it('inclui o status de origem e destino', () => {
      const machine = new ChargeStateMachine(ChargeStatus.CREATED);
      expect(() => machine.transitionTo(ChargeStatus.PAID)).toThrow(/CREATED.*PAID/);
    });
  });

  describe('self-transition é inválida em qualquer estado', () => {
    it.each(Object.values(ChargeStatus))('%s → %s lança', (status) => {
      expect(() =>
        new ChargeStateMachine(status).transitionTo(status),
      ).toThrow(InvalidStateTransitionError);
    });
  });

  describe('estado terminal: PAID — nenhuma saída permitida', () => {
    it.each(Object.values(ChargeStatus))('PAID → %s lança', (to) => {
      expect(() =>
        new ChargeStateMachine(ChargeStatus.PAID).transitionTo(to),
      ).toThrow(InvalidStateTransitionError);
    });
  });

  describe('estado terminal: EXPIRED — nenhuma saída permitida', () => {
    it.each(Object.values(ChargeStatus))('EXPIRED → %s lança', (to) => {
      expect(() =>
        new ChargeStateMachine(ChargeStatus.EXPIRED).transitionTo(to),
      ).toThrow(InvalidStateTransitionError);
    });
  });
});
