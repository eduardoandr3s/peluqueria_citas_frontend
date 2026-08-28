import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import {
  AuthService,
  Cita,
  CitaCierre,
  CitaRequest,
  CitaUpdate,
  DiaCerrado,
  ESTADOS_CIERRE,
  ETIQUETA_ESTADO,
  EstadoCita,
  Servicio,
  Usuario,
  Peluquero,
  CitaService,
  ServicioService,
  UsuarioService,
  PagoService,
  PeluqueroService,
  hoyIso,
  sumarMeses,
  formatearImporte,
} from '@peluqueria/core';
import { DatePicker } from '../../shared/date-picker/date-picker';

type EstadoFiltro = 'TODAS' | EstadoCita;

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

@Component({
  selector: 'app-citas',
  imports: [ReactiveFormsModule, FormsModule, DatePipe, DatePicker],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-main">{{ esAdmin() ? 'Citas' : 'Mi agenda' }}</h1>
          <p class="text-sm text-muted">
            @if (esAdmin()) {
              Agenda y gestiona el estado de las citas.
            } @else {
              Tus citas asignadas. Al cerrarlas cuentan en tu producción.
            }
          </p>
        </div>
        @if (esAdmin()) {
        <button
          type="button"
          (click)="abrirAgendar()"
          class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agendar cita
        </button>
        }
      </div>

      @if (feedback(); as fb) {
        <div
          class="flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm"
          [class]="fb.type === 'success' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'"
        >
          <span>{{ fb.text }}</span>
          <button type="button" (click)="feedback.set(null)" class="font-medium hover:opacity-70">✕</button>
        </div>
      }

      <!-- Filtros por estado + buscador -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2">
          @for (f of filtros; track f.value) {
            <button
              type="button"
              (click)="estadoFiltro.set(f.value)"
              class="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
              [class]="estadoFiltro() === f.value ? 'bg-primary text-white' : 'bg-surface text-main ring-1 ring-line hover:bg-elevated'"
            >
              {{ f.label }}
              <span
                class="ml-1.5 rounded-full px-1.5 text-xs"
                [class]="estadoFiltro() === f.value ? 'bg-primary' : 'bg-elevated'"
                >{{ contar(f.value) }}</span
              >
            </button>
          }
        </div>
        <div class="relative max-w-xs flex-1">
          <svg
            class="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-muted"
            fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
            placeholder="Buscar por cliente o servicio…"
            class="w-full rounded-lg border border-line bg-base py-2 pl-10 pr-3 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div class="rounded-xl bg-surface shadow-sm ring-1 ring-line">
        @if (loading()) {
          <div class="space-y-3 p-5">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="h-10 animate-pulse rounded bg-elevated"></div>
            }
          </div>
        } @else if (loadError()) {
          <div class="p-8 text-center">
            <p class="text-sm text-error">{{ loadError() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="mt-3 rounded-lg bg-elevated px-4 py-2 text-sm font-medium text-main hover:bg-line"
            >
              Reintentar
            </button>
          </div>
        } @else if (filtered().length === 0) {
          <div class="p-8 text-center text-sm text-muted">
            @if (citas().length === 0) {
              Aún no hay citas. Agenda la primera con «Agendar cita».
            } @else {
              No hay citas que coincidan con el filtro.
            }
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="px-5 py-3 font-medium">Cliente</th>
                  <th class="px-5 py-3 font-medium">Servicio</th>
                  <th class="px-5 py-3 font-medium">Peluquero</th>
                  <th class="px-5 py-3 font-medium">Fecha y hora</th>
                  <th class="px-5 py-3 font-medium">Estado / Pago</th>
                  <th class="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                @for (c of filtered(); track c.idCita) {
                  <tr class="hover:bg-elevated">
                    <td class="px-5 py-3">
                      <p class="font-medium text-main">{{ c.usuario.nombre }}</p>
                      <p class="text-xs text-muted">{{ c.usuario.email }}</p>
                    </td>
                    <td class="px-5 py-3">
                      <p class="text-main">{{ c.servicio.nombre }}</p>
                      <p class="text-xs text-muted">{{ c.servicio.duracion }} min</p>
                    </td>
                    <td class="px-5 py-3">
                      <p class="text-main">{{ c.peluquero?.nombre ?? '—' }}</p>
                    </td>
                    <td class="px-5 py-3 text-main">
                      <p>{{ c.fechaHora | date: 'EEE dd/MM/yyyy' }}</p>
                      <p class="text-xs text-muted">{{ c.fechaHora | date: 'HH:mm' }} – {{ horaFin(c) }}</p>
                    </td>
                    <td class="px-5 py-3">
                      <div class="flex flex-col gap-1">
                        <span
                          class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          [class]="estadoClass(c.estado)"
                          >{{ etiqueta(c.estado) }}</span
                        >
                        @if (c.estadoPago; as estadoPago) {
                          <span
                            class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            [class]="pagoClass(estadoPago)"
                            >{{ labelPago(c) }}</span
                          >
                        }
                        @if (c.observaciones) {
                          <!-- El texto completo va en el title: la fila no puede crecer con
                               dos mil caracteres de notas. -->
                          <p class="max-w-[16rem] truncate text-xs italic text-muted" [title]="c.observaciones">
                            {{ c.observaciones }}
                          </p>
                        }
                        @if (c.estado === 'ANULADA' && c.clienteContactado) {
                          <span class="text-xs text-muted">Cliente avisado</span>
                        }
                      </div>
                    </td>
                    <td class="px-5 py-3">
                      <div class="flex items-center justify-end gap-2">
                        @if (busyId() === c.idCita) {
                          <span class="text-xs text-muted">Procesando…</span>
                        } @else {
                          @if (c.estado === 'PENDIENTE') {
                            <button
                              type="button"
                              (click)="cambiarEstado(c, 'CONFIRMADA')"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10"
                            >
                              Confirmar
                            </button>
                          }
                          @if (!estaCerrada(c.estado)) {
                            <button
                              type="button"
                              (click)="abrirCierre(c, 'COMPLETADA')"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                            >
                              Cerrar
                            </button>
                          }
                          @if (esAdmin() && c.estado !== 'ANULADA' && puedePagoManual(c)) {
                            <button
                              type="button"
                              (click)="abrirPagoManual(c)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                            >
                              Pago manual
                            </button>
                          }
                          <!--
                            Reembolsar queda FUERA del bloque de «no anulada»: cobrar y devolver
                            son decisiones separadas de anular (el backend tampoco mira el estado
                            de la cita). Dentro, el dinero de una cita anulada se quedaba cogido.
                          -->
                          @if (esAdmin() && puedeReembolsar(c)) {
                            <button
                              type="button"
                              (click)="pendingReembolso.set(c)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10"
                            >
                              Reembolsar
                            </button>
                          }
                          @if (esAdmin() && !estaCerrada(c.estado)) {
                            <button
                              type="button"
                              (click)="abrirEditar(c)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                            >
                              Reprogramar
                            </button>
                          }
                          @if (!estaCerrada(c.estado)) {
                            <button
                              type="button"
                              (click)="abrirCierre(c, 'ANULADA')"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/10"
                            >
                              Anular
                            </button>
                          }
                          @if (esAdmin()) {
                            <button
                              type="button"
                              (click)="pendingDelete.set(c)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10"
                            >
                              Eliminar
                            </button>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <!-- Modal: agendar / reprogramar cita -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <form
          [formGroup]="form"
          (ngSubmit)="guardar()"
          class="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold text-main">
            {{ editando() ? 'Reprogramar cita' : 'Agendar cita' }}
          </h2>
          <p class="mt-1 text-xs text-muted">
            Horario: lunes a sábado, de 09:00 a 20:00 (la cita debe terminar antes de las 20:00).
            Los domingos y los días bloqueados en «Días cerrados» no se pueden elegir.
          </p>

          @if (formError()) {
            <div class="mt-4 rounded-lg bg-error/15 px-3.5 py-2.5 text-sm text-error">
              {{ formError() }}
            </div>
          }

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Cliente</label>
              <select
                formControlName="usuarioId"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option [ngValue]="null" disabled>Selecciona un cliente…</option>
                @for (u of usuariosForm(); track u.idUsuario) {
                  <option [ngValue]="u.idUsuario">{{ u.nombre }} — {{ u.email }}</option>
                }
              </select>
              @if (invalid('usuarioId')) {
                <p class="mt-1 text-xs text-error">Selecciona un cliente.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Servicio</label>
              <select
                formControlName="servicioId"
                (change)="onContextoSlotsCambio()"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option [ngValue]="null" disabled>Selecciona un servicio…</option>
                @for (s of serviciosForm(); track s.idServicio) {
                  <option [ngValue]="s.idServicio">{{ s.nombre }} ({{ s.duracion }} min)</option>
                }
              </select>
              @if (invalid('servicioId')) {
                <p class="mt-1 text-xs text-error">Selecciona un servicio.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">
                Peluquero <span class="text-muted">(opcional)</span>
              </label>
              <select
                formControlName="peluqueroId"
                (change)="onContextoSlotsCambio()"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option [ngValue]="null">Cualquiera</option>
                @for (p of peluqueros(); track p.idPeluquero) {
                  <option [ngValue]="p.idPeluquero">{{ p.nombre }}</option>
                }
              </select>
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Fecha</label>
              <app-date-picker
                formControlName="fecha"
                [min]="minFecha"
                [maxMeses]="mesesCalendario"
                [diasCerrados]="diasCerrados()"
                (fechaElegida)="onContextoSlotsCambio()"
              />
              @if (invalid('fecha')) {
                <p class="mt-1 text-xs text-error">Indica la fecha.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Hora</label>
              @if (!form.controls.servicioId.value || !form.controls.fecha.value) {
                <p class="text-xs text-muted">Elige servicio y fecha para ver las horas libres.</p>
              } @else if (slotsLoading()) {
                <p class="text-xs text-muted">Cargando horas libres…</p>
              } @else if (slotsError()) {
                <p class="text-xs text-error">{{ slotsError() }}</p>
              } @else if (slotsMostrados().length === 0) {
                <p class="text-xs text-muted">
                  No hay horas libres ese día (puede estar completo o cerrado).
                </p>
              } @else {
                <div class="flex flex-wrap gap-2">
                  @for (s of slotsMostrados(); track s) {
                    <button
                      type="button"
                      (click)="seleccionarHora(s)"
                      class="rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition"
                      [class]="
                        form.controls.hora.value === s
                          ? 'bg-primary text-white ring-primary'
                          : 'bg-surface text-main ring-line hover:bg-elevated'
                      "
                    >
                      {{ s }}@if (esHoraActual(s)) {
                        <span class="ml-1 text-xs opacity-70">(actual)</span>
                      }
                    </button>
                  }
                </div>
              }
              @if (invalid('hora')) {
                <p class="mt-1 text-xs text-error">Selecciona una hora.</p>
              }
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="formOpen.set(false)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="saving()"
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              @if (saving()) {
                Guardando…
              } @else {
                {{ editando() ? 'Guardar cambios' : 'Agendar' }}
              }
            </button>
          </div>
        </form>
      </div>
    }

    <!-- Modal: pago manual -->
    @if (pendingPagoManual(); as c) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-main">Registrar pago manual</h2>
          <p class="mt-2 text-sm text-main">
            Cita de {{ c.usuario.nombre }} — {{ c.servicio.nombre }} ({{ importe(c.servicio.precio) }} €)
          </p>
          <div class="mt-4 space-y-3">
            <label class="mb-1.5 block text-sm font-medium text-main">Método de pago</label>
            <div class="flex gap-3">
              <button
                type="button"
                (click)="metodoPagoManual.set('EFECTIVO')"
                class="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition"
                [class]="metodoPagoManual() === 'EFECTIVO' ? 'border-primary bg-primary/10 text-primary' : 'border-line text-main hover:bg-elevated'"
              >
                Efectivo
              </button>
              <button
                type="button"
                (click)="metodoPagoManual.set('TRANSFERENCIA')"
                class="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition"
                [class]="metodoPagoManual() === 'TRANSFERENCIA' ? 'border-primary bg-primary/10 text-primary' : 'border-line text-main hover:bg-elevated'"
              >
                Transferencia
              </button>
            </div>
          </div>
          @if (pagoManualError()) {
            <p class="mt-3 text-sm text-error">{{ pagoManualError() }}</p>
          }
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="cerrarPagoManual()"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              type="button"
              [disabled]="pagoManualSaving()"
              (click)="registrarPagoManual(c)"
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              @if (pagoManualSaving()) {
                Registrando…
              } @else {
                Confirmar pago
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: cerrar cita (realizada / no asistió / anulada) -->
    @if (pendingCierre(); as c) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-main">Cerrar cita</h2>
          <p class="mt-2 text-sm text-main">
            {{ c.usuario.nombre }} · {{ c.servicio.nombre }} ·
            {{ c.fechaHora | date: "dd/MM/yyyy 'a las' HH:mm" }}
          </p>

          <div class="mt-4 space-y-2">
            @for (e of estadosCierre; track e) {
              <label
                class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition"
                [class]="
                  estadoCierre() === e
                    ? 'border-primary bg-primary/5'
                    : 'border-line hover:bg-elevated'
                "
              >
                <input
                  type="radio"
                  name="estadoCierre"
                  class="mt-0.5 h-4 w-4 text-primary focus:ring-primary/30"
                  [checked]="estadoCierre() === e"
                  (change)="estadoCierre.set(e)"
                />
                <span>
                  <span class="block text-sm font-medium text-main">{{ etiqueta(e) }}</span>
                  <span class="block text-xs text-muted">{{ explicacionCierre(e) }}</span>
                </span>
              </label>
            }
          </div>

          @if (estadoCierre() === 'COMPLETADA' && !puedeContarEnProduccion(c)) {
            <p class="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-main">
              Esta cita no tiene el pago registrado, así que se marcará como realizada pero
              <strong>no sumará en la producción</strong> hasta que se cobre.
              @if (esAdmin()) {
                Puedes registrarlo con «Pago manual».
              }
            </p>
          }
          @if (estadoCierre() === 'ANULADA' && c.estadoPago === 'PAGADO') {
            <p class="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-main">
              La cita está pagada. Anularla no devuelve el dinero: el reembolso lo hace un
              administrador aparte.
            </p>
          }

          <div class="mt-4">
            <label class="mb-1.5 block text-sm font-medium text-main">
              Observaciones
              <span class="font-normal text-muted">(opcional)</span>
            </label>
            <textarea
              rows="3"
              [ngModel]="observacionesCierre()"
              (ngModelChange)="observacionesCierre.set($event)"
              maxlength="2000"
              placeholder="Qué ha pasado: lo que se hizo, por qué se anula…"
              class="w-full rounded-lg border border-line bg-base px-3 py-2 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
            ></textarea>
            <p class="mt-1 text-xs text-muted">
              Nota interna: el cliente no la ve.
            </p>
          </div>

          @if (estadoCierre() === 'ANULADA') {
            <div class="mt-3 flex items-start gap-2">
              <input
                id="cliente-contactado"
                type="checkbox"
                [ngModel]="clienteContactado()"
                (ngModelChange)="clienteContactado.set($event)"
                class="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary/30"
              />
              <label for="cliente-contactado" class="text-sm text-main">
                Ya he avisado al cliente
                <span class="block text-xs text-muted">
                  Queda registrado. El correo automático de anulación se envía igual.
                </span>
              </label>
            </div>
          }

          @if (cierreError(); as err) {
            <p class="mt-3 rounded-lg bg-error/15 px-3 py-2 text-xs text-error">{{ err }}</p>
          }

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="cerrarModalCierre()"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              type="button"
              [disabled]="cierreSaving()"
              (click)="confirmarCierre(c)"
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {{ cierreSaving() ? 'Guardando…' : 'Cerrar cita' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: eliminar cita -->
    @if (pendingDelete(); as c) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-main">Eliminar cita</h2>
          <p class="mt-2 text-sm text-main">
            Se borrará la cita de {{ c.usuario.nombre }} ({{ c.servicio.nombre }},
            {{ c.fechaHora | date: "dd/MM/yyyy 'a las' HH:mm" }}). Esto no se puede deshacer y
            la cita desaparece del historial y de las estadísticas.
          </p>
          <p class="mt-2 text-sm text-muted">
            Se avisará al cliente por correo. Si la cita tiene un pago registrado no se podrá
            borrar: anúlala en su lugar.
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="pendingDelete.set(null)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="eliminar(c)"
              class="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white transition hover:bg-error/80"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: reembolsar -->
    @if (pendingReembolso(); as c) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-main">Reembolsar pago</h2>
          <p class="mt-2 text-sm text-main">
            Se reembolsará el pago de {{ c.servicio.nombre }} ({{ importe(c.servicio.precio) }} €) de {{ c.usuario.nombre }}.
          </p>
          @if (c.estado === 'ANULADA') {
            <p class="mt-2 text-sm text-muted">
              La cita ya está anulada: esto solo devuelve el importe.
            </p>
          } @else {
            <p class="mt-2 text-sm text-warning font-medium">
              El reembolso no anula la cita; anúlala aparte si procede.
            </p>
          }
          @if (reembolsoError()) {
            <p class="mt-3 text-sm text-error">{{ reembolsoError() }}</p>
          }
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="pendingReembolso.set(null); reembolsoError.set(null)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              type="button"
              [disabled]="reembolsoSaving()"
              (click)="reembolsar(c)"
              class="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white transition hover:bg-error/80 disabled:opacity-60"
            >
              @if (reembolsoSaving()) {
                Reembolsando…
              } @else {
                Reembolsar
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class Citas implements OnInit {
  private readonly citaService = inject(CitaService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly servicioService = inject(ServicioService);
  private readonly pagoService = inject(PagoService);
  private readonly peluqueroService = inject(PeluqueroService);

  /** Formato de importes, uno solo para panel y móvil. */
  protected readonly importe = formatearImporte;
  private readonly fb = inject(FormBuilder);

  private readonly auth = inject(AuthService);
  /**
   * Un PELUQUERO usa esta misma pantalla, pero solo con lo que es suyo: confirmar, cerrar y
   * anular. Agendar, reprogramar, cobrar, reembolsar y eliminar son de ADMIN. Ocultarlo no
   * es la seguridad —esa la pone el backend— pero enseñar botones que van a dar 403 sí es
   * una pantalla rota.
   */
  protected readonly esAdmin = this.auth.isAdmin;

  protected readonly citas = signal<Cita[]>([]);
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly servicios = signal<Servicio[]>([]);
  protected readonly peluqueros = signal<Peluquero[]>([]);
  /** Días que el calendario del formulario debe dejar sin seleccionar. */
  protected readonly diasCerrados = signal<DiaCerrado[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly estadoFiltro = signal<EstadoFiltro>('TODAS');
  protected readonly busyId = signal<number | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly editando = signal<Cita | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  /** Cita cuyo cierre se está editando en el modal. */
  protected readonly pendingCierre = signal<Cita | null>(null);
  protected readonly estadoCierre = signal<EstadoCita>('COMPLETADA');
  protected readonly observacionesCierre = signal('');
  protected readonly clienteContactado = signal(false);
  protected readonly cierreSaving = signal(false);
  protected readonly cierreError = signal<string | null>(null);
  protected readonly estadosCierre = ESTADOS_CIERRE;
  protected readonly pendingDelete = signal<Cita | null>(null);

  // Pago manual
  protected readonly pendingPagoManual = signal<Cita | null>(null);
  protected readonly metodoPagoManual = signal<string>('EFECTIVO');
  protected readonly pagoManualSaving = signal(false);
  protected readonly pagoManualError = signal<string | null>(null);

  // Reembolso
  protected readonly pendingReembolso = signal<Cita | null>(null);
  protected readonly reembolsoSaving = signal(false);
  protected readonly reembolsoError = signal<string | null>(null);

  // Disponibilidad: horas libres para el servicio + fecha elegidos en el modal.
  protected readonly slots = signal<string[]>([]);
  protected readonly slotsLoading = signal(false);
  protected readonly slotsError = signal<string | null>(null);

  /** Meses que se pueden navegar en el calendario (el backend acepta un rango máximo de 12). */
  protected readonly mesesCalendario = 11;
  protected readonly minFecha = hoyIso();
  /** Tope del calendario y del rango de cierres que se pide al backend. */
  protected readonly maxFecha = sumarMeses(this.minFecha, this.mesesCalendario);

  protected readonly filtros: { value: EstadoFiltro; label: string }[] = [
    { value: 'TODAS', label: 'Todas' },
    { value: 'PENDIENTE', label: 'Pendientes' },
    { value: 'CONFIRMADA', label: 'Confirmadas' },
    { value: 'COMPLETADA', label: 'Realizadas' },
    { value: 'NO_ASISTIO', label: 'No asistió' },
    { value: 'ANULADA', label: 'Anuladas' },
  ];

  protected readonly form = this.fb.group({
    usuarioId: [null as number | null, [Validators.required]],
    servicioId: [null as number | null, [Validators.required]],
    peluqueroId: [null as number | null],
    fecha: ['', [Validators.required]],
    hora: ['', [Validators.required]],
  });

  /** Usuarios para el select; si se reprograma una cita de un usuario desactivado, lo incluye. */
  protected readonly usuariosForm = computed<{ idUsuario: number; nombre: string; email: string }[]>(() => {
    const lista = this.usuarios();
    const e = this.editando();
    if (e && !lista.some((u) => u.idUsuario === e.usuario.idUsuario)) {
      return [e.usuario, ...lista];
    }
    return lista;
  });

  /** Servicios para el select; si se reprograma una cita de un servicio desactivado, lo incluye. */
  protected readonly serviciosForm = computed(() => {
    const lista = this.servicios();
    const e = this.editando();
    if (e && !lista.some((s) => s.idServicio === e.servicio.idServicio)) {
      return [e.servicio, ...lista];
    }
    return lista;
  });

  /**
   * Horas a mostrar como botones: las libres del backend y, al reprogramar, también
   * la hora actual de la cita (que el backend ve como ocupada por ella misma).
   */
  protected readonly slotsMostrados = computed<string[]>(() => {
    const libres = this.slots();
    const e = this.editando();
    if (e) {
      const horaActual = e.fechaHora.slice(11, 16);
      if (!libres.includes(horaActual)) {
        return [...libres, horaActual].sort();
      }
    }
    return libres;
  });

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const est = this.estadoFiltro();
    return this.citas()
      .filter((c) => est === 'TODAS' || c.estado === est)
      .filter(
        (c) =>
          !q ||
          c.usuario.nombre.toLowerCase().includes(q) ||
          c.servicio.nombre.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime());
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      citas: this.citaService.listar(),
      // La lista de usuarios es de ADMIN: un PELUQUERO recibiría un 403 y, dentro de un
      // forkJoin, ese 403 tumbaría también las citas y dejaría la pantalla vacía. Solo la
      // necesita el formulario de agendar, que él no tiene.
      usuarios: this.esAdmin() ? this.usuarioService.listarTodos() : of<Usuario[]>([]),
      servicios: this.servicioService.listar(),
      peluqueros: this.peluqueroService.listar(),
      // Un año de cierres de golpe: es lo que se puede navegar en el calendario, así
      // no hay que volver al backend cada vez que se cambia de mes.
      diasCerrados: this.citaService.diasCerrados(this.minFecha, this.maxFecha),
    }).subscribe({
      next: ({ citas, usuarios, servicios, peluqueros, diasCerrados }) => {
        this.citas.set(citas);
        this.usuarios.set(usuarios);
        this.servicios.set(servicios);
        this.peluqueros.set(peluqueros);
        this.diasCerrados.set(diasCerrados);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar las citas.');
        this.loading.set(false);
      },
    });
  }

  protected puedePagoManual(c: Cita): boolean {
    return c.estadoPago !== 'PAGADO' && c.estadoPago !== 'REEMBOLSADO';
  }

  protected puedeReembolsar(c: Cita): boolean {
    return c.estadoPago === 'PAGADO';
  }

  protected abrirPagoManual(c: Cita): void {
    this.pendingPagoManual.set(c);
    this.metodoPagoManual.set('EFECTIVO');
    this.pagoManualError.set(null);
  }

  protected cerrarPagoManual(): void {
    this.pendingPagoManual.set(null);
    this.pagoManualError.set(null);
  }

  protected registrarPagoManual(c: Cita): void {
    this.pagoManualSaving.set(true);
    this.pagoManualError.set(null);
    this.pagoService.registrarManual(c.idCita, this.metodoPagoManual()).subscribe({
      next: (pago) => {
        this.citas.update((list) =>
          list.map((x) =>
            x.idCita === c.idCita
              ? { ...x, estado: 'CONFIRMADA' as EstadoCita, estadoPago: pago.estadoPago }
              : x,
          ),
        );
        this.pagoManualSaving.set(false);
        this.pendingPagoManual.set(null);
        this.feedback.set({ type: 'success', text: 'Pago registrado y cita confirmada.' });
      },
      error: (err: HttpErrorResponse) => {
        this.pagoManualSaving.set(false);
        this.pagoManualError.set(this.extraerError(err) ?? 'No se pudo registrar el pago.');
      },
    });
  }

  protected reembolsar(c: Cita): void {
    this.reembolsoSaving.set(true);
    this.reembolsoError.set(null);
    this.pagoService.reembolsar(c.idCita).subscribe({
      next: () => {
        this.citas.update((list) =>
          list.map((x) =>
            x.idCita === c.idCita ? { ...x, estadoPago: 'REEMBOLSADO' as const } : x,
          ),
        );
        this.reembolsoSaving.set(false);
        this.pendingReembolso.set(null);
        this.feedback.set({ type: 'success', text: 'Pago reembolsado.' });
      },
      error: (err: HttpErrorResponse) => {
        this.reembolsoSaving.set(false);
        this.reembolsoError.set(this.extraerError(err) ?? 'No se pudo reembolsar.');
      },
    });
  }

  protected labelPago(c: Cita): string {
    // El importe cobrado es el precio del servicio de la cita.
    const importe = formatearImporte(c.servicio.precio);
    switch (c.estadoPago) {
      case 'PENDIENTE': return 'Pago pendiente';
      case 'PAGADO': return `${importe} € pagado`;
      case 'REEMBOLSADO': return `${importe} € reembolsado`;
      case 'CANCELADO': return 'Pago cancelado';
      default: return c.estadoPago ?? '';
    }
  }

  protected pagoClass(estado: string): string {
    switch (estado) {
      case 'PAGADO': return 'bg-success/15 text-success';
      case 'PENDIENTE': return 'bg-warning/15 text-warning';
      case 'REEMBOLSADO': return 'bg-elevated text-muted';
      case 'CANCELADO': return 'bg-elevated text-muted';
      default: return 'bg-elevated text-muted';
    }
  }

  protected contar(filtro: EstadoFiltro): number {
    const citas = this.citas();
    return filtro === 'TODAS' ? citas.length : citas.filter((c) => c.estado === filtro).length;
  }

  protected horaFin(c: Cita): string {
    const inicio = new Date(c.fechaHora);
    const fin = new Date(inicio.getTime() + c.servicio.duracion * 60000);
    return fin.toTimeString().slice(0, 5);
  }

  protected estadoClass(estado: EstadoCita): string {
    switch (estado) {
      case 'CONFIRMADA':
        return 'bg-success/15 text-success';
      case 'COMPLETADA':
        // Más marcado que «confirmada»: es el estado que genera producción.
        return 'bg-success/25 text-success';
      case 'NO_ASISTIO':
        return 'bg-error/15 text-error';
      case 'ANULADA':
        return 'bg-elevated text-muted';
      default:
        return 'bg-warning/15 text-warning';
    }
  }

  protected etiqueta(estado: EstadoCita): string {
    return ETIQUETA_ESTADO[estado] ?? estado;
  }

  /** Una cita cerrada ya no se mueve; solo un ADMIN puede corregir el cierre. */
  protected estaCerrada(estado: EstadoCita): boolean {
    return ESTADOS_CIERRE.includes(estado);
  }

  protected explicacionCierre(estado: EstadoCita): string {
    switch (estado) {
      case 'COMPLETADA':
        return 'El servicio se hizo. Suma en la producción si el pago está registrado.';
      case 'NO_ASISTIO':
        return 'El cliente no vino. No genera producción ni comisión.';
      default:
        return 'La cita no se hace. Se avisa al cliente por correo y el hueco queda libre.';
    }
  }

  /** Si al completar va a contar como vendido, o si se queda pendiente de cobro. */
  protected puedeContarEnProduccion(c: Cita): boolean {
    return c.estadoPago === 'PAGADO';
  }

  protected invalid(control: 'usuarioId' | 'servicioId' | 'fecha' | 'hora'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected abrirAgendar(): void {
    this.feedback.set(null);
    this.formError.set(null);
    this.editando.set(null);
    this.slots.set([]);
    this.slotsError.set(null);
    this.form.reset({ usuarioId: null, servicioId: null, fecha: '', hora: '' });
    this.formOpen.set(true);
  }

  protected abrirEditar(c: Cita): void {
    this.feedback.set(null);
    this.formError.set(null);
    this.slots.set([]);
    this.slotsError.set(null);
    this.editando.set(c);
    this.form.reset({
      usuarioId: c.usuario.idUsuario,
      servicioId: c.servicio.idServicio,
      fecha: c.fechaHora.slice(0, 10),
      hora: c.fechaHora.slice(11, 16),
    });
    this.formOpen.set(true);
    this.cargarSlots();
  }

  /** Recarga las horas libres y limpia la hora elegida (cambió servicio o fecha). */
  protected onContextoSlotsCambio(): void {
    this.form.controls.hora.setValue('');
    this.cargarSlots();
  }

  protected seleccionarHora(hora: string): void {
    this.form.controls.hora.setValue(hora);
    this.form.controls.hora.markAsTouched();
  }

  protected esHoraActual(hora: string): boolean {
    const e = this.editando();
    return !!e && e.fechaHora.slice(11, 16) === hora;
  }

  private cargarSlots(): void {
    const servicioId = this.form.controls.servicioId.value;
    const fecha = this.form.controls.fecha.value;
    const peluqueroId = this.form.controls.peluqueroId.value ?? undefined;
    if (!servicioId || !fecha) {
      this.slots.set([]);
      this.slotsError.set(null);
      return;
    }
    this.slotsLoading.set(true);
    this.slotsError.set(null);
    this.citaService.disponibilidad(fecha, servicioId, peluqueroId).subscribe({
      next: (horas) => {
        this.slots.set(horas);
        this.slotsLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.slots.set([]);
        this.slotsError.set(this.extraerError(err) ?? 'No se pudieron cargar las horas libres.');
        this.slotsLoading.set(false);
      },
    });
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);

    const fechaHora = `${v.fecha}T${v.hora}:00`;

    const editando = this.editando();
    if (editando) {
      const payload: CitaUpdate = {
        usuarioId: v.usuarioId!,
        servicioId: v.servicioId!,
        fechaHora,
        peluqueroId: v.peluqueroId ?? undefined,
      };
      this.citaService.actualizar(editando.idCita, payload).subscribe({
        next: (actualizada) => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.citas.update((list) =>
            list.map((x) => (x.idCita === actualizada.idCita ? actualizada : x)),
          );
          this.feedback.set({
            type: 'success',
            text: `Cita de ${actualizada.usuario.nombre} reprogramada.`,
          });
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(this.extraerError(err) ?? 'No se pudo reprogramar la cita.');
        },
      });
      return;
    }

    const payload: CitaRequest = {
      usuarioId: v.usuarioId!,
      servicioId: v.servicioId!,
      fechaHora,
      peluqueroId: v.peluqueroId ?? undefined,
    };
    this.citaService.agendar(payload).subscribe({
      next: (cita) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.citas.update((list) => [...list, cita]);
        this.feedback.set({
          type: 'success',
          text: `Cita agendada para ${cita.usuario.nombre}.`,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(this.extraerError(err) ?? 'No se pudo agendar la cita.');
      },
    });
  }

  protected cambiarEstado(c: Cita, estado: EstadoCita): void {
    const id = c.idCita;
    this.busyId.set(id);
    this.citaService.actualizar(id, { estado }).subscribe({
      next: (actualizada) => {
        this.citas.update((list) => list.map((x) => (x.idCita === id ? actualizada : x)));
        this.busyId.set(null);
        this.feedback.set({ type: 'success', text: `Cita marcada como ${estado}.` });
      },
      error: (err: HttpErrorResponse) => this.onError(err),
    });
  }

  protected abrirCierre(c: Cita, estado: EstadoCita): void {
    this.feedback.set(null);
    this.cierreError.set(null);
    this.estadoCierre.set(estado);
    // Se parte de lo que ya hubiera: reabrir el modal no borra las notas de un cierre previo.
    this.observacionesCierre.set(c.observaciones ?? '');
    this.clienteContactado.set(c.clienteContactado ?? false);
    this.pendingCierre.set(c);
  }

  protected cerrarModalCierre(): void {
    this.pendingCierre.set(null);
    this.cierreError.set(null);
  }

  protected confirmarCierre(c: Cita): void {
    const id = c.idCita;
    const payload: CitaCierre = {
      estado: this.estadoCierre(),
      observaciones: this.observacionesCierre().trim() || undefined,
      clienteContactado: this.estadoCierre() === 'ANULADA' ? this.clienteContactado() : false,
    };

    this.cierreSaving.set(true);
    this.cierreError.set(null);
    this.citaService.cerrar(id, payload).subscribe({
      next: (actualizada) => {
        this.citas.update((list) => list.map((x) => (x.idCita === id ? actualizada : x)));
        this.cierreSaving.set(false);
        this.pendingCierre.set(null);
        this.feedback.set({
          type: 'success',
          text: `Cita de ${c.usuario.nombre} cerrada como «${this.etiqueta(payload.estado)}».`,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.cierreSaving.set(false);
        // El error se queda DENTRO del modal: el 403 del cierre ya hecho y el 400 de la
        // cita que no ha empezado se corrigen sin salir de aquí.
        this.cierreError.set(this.extraerError(err) ?? 'No se pudo cerrar la cita.');
      },
    });
  }

  protected eliminar(c: Cita): void {
    const id = c.idCita;
    this.pendingDelete.set(null);
    this.busyId.set(id);
    this.citaService.eliminar(id).subscribe({
      next: () => {
        this.citas.update((list) => list.filter((x) => x.idCita !== id));
        this.busyId.set(null);
        this.feedback.set({ type: 'success', text: 'Cita eliminada.' });
      },
      error: (err: HttpErrorResponse) => this.onError(err),
    });
  }

  private onError(err: HttpErrorResponse): void {
    this.busyId.set(null);
    this.feedback.set({
      type: 'error',
      text: this.extraerError(err) ?? 'Ocurrió un error al procesar la acción.',
    });
  }

  private extraerError(err: HttpErrorResponse): string | null {
    const body = err.error;
    if (!body) return null;
    if (typeof body === 'string') return body;
    if (body.error) return body.error;
    const valores = Object.values(body);
    return valores.length ? String(valores[0]) : null;
  }

}
