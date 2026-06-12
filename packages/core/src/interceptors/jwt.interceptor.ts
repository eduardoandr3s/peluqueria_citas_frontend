import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Añade el header `Authorization: Bearer <token>` a cada petición saliente
 * y, si el backend rechaza la sesión, cierra sesión y redirige al login.
 *
 * El backend responde 403 (no 401) cuando el token es inválido, ha expirado,
 * fue revocado (tokenVersion) o la cuenta está desactivada: la petición llega
 * sin autenticación a un recurso protegido. Por eso tratamos 401 y 403 igual.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.getToken();
  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 || err.status === 403) {
        auth.logout();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
