import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Devuelve una copia de la petición con el header Authorization: Bearer <token>. */
function conBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Añade el header `Authorization: Bearer <token>` a cada petición saliente y,
 * cuando el backend rechaza la sesión (401/403, p. ej. access token caducado),
 * intenta renovarla con el refresh token ANTES de cerrar sesión:
 *
 *  - Si la rotación funciona, reintenta la petición original con el token nuevo.
 *  - Si falla (refresh caducado/revocado, o credenciales cambiadas), cierra
 *    sesión y redirige al login.
 *
 * Las peticiones a `/auth/*` (login, refresh, logout, recuperar, reset) quedan
 * excluidas del reintento para no entrar en bucle: el fallo de un login lo
 * gestiona su página, y el fallo de `/auth/refresh` ya desemboca en logout más
 * abajo. Varias peticiones que caduquen a la vez comparten una sola rotación
 * (ver `AuthService.refresh`).
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.getToken();
  const request = token ? conBearer(req, token) : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      const sesionRechazada = err.status === 401 || err.status === 403;
      const esLlamadaAuth = req.url.includes('/auth/');

      if (sesionRechazada && !esLlamadaAuth) {
        if (auth.getRefreshToken()) {
          return auth.refresh().pipe(
            switchMap((res) => next(conBearer(req, res.token))),
            catchError((refreshErr) => {
              auth.logout();
              router.navigate(['/login']);
              return throwError(() => refreshErr);
            }),
          );
        }
        // Sin refresh token con el que recuperar la sesión: cerrar directamente.
        auth.logout();
        router.navigate(['/login']);
      }

      return throwError(() => err);
    }),
  );
};
