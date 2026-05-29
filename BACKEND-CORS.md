# Configurar CORS en el backend (peluqueria_citas)

El frontend admin corre en `http://localhost:4200` y el API en `http://localhost:8080`.
Como son orígenes distintos, el navegador bloqueará las llamadas **hasta que el backend
declare que confía en el origen del frontend**. Estos son los cambios a aplicar en el
repositorio `peluqueria_citas`.

## 1. Habilitar CORS en `SecurityConfig.java`

En `src/main/java/com/segovia/peluqueria/security/SecurityConfig.java`:

```java
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.beans.factory.annotation.Value;
import java.util.List;

// ...

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // Lee los orígenes permitidos desde application.properties (separados por coma)
    @Value("${cors.allowed-origins}")
    private List<String> allowedOrigins;

    // ... (constructor y passwordEncoder existentes) ...

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                // 👇 añade esta línea
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // ... tus reglas actuales sin cambios ...
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

> ⚠️ No uses `setAllowedOrigins(List.of("*"))` junto con `setAllowCredentials(true)`:
> Spring lo rechaza. Por eso listamos los orígenes explícitamente.

## 2. Declarar los orígenes en `application.properties`

```properties
# Orígenes permitidos para CORS (frontend admin en dev)
cors.allowed-origins=http://localhost:4200
```

Y en producción, en `application-prod.properties`, añade la URL real del panel desplegado:

```properties
cors.allowed-origins=https://admin.tu-dominio.com
```

## 3. Crear un usuario ADMIN

El endpoint `/api/auth/registro` crea usuarios con rol **USER** (no ADMIN). Para entrar al
panel necesitas al menos un ADMIN. Opciones:

- **Vía SQL** (rápido), una vez registrado un usuario normal:
  ```sql
  UPDATE usuarios SET rol = 'ADMIN' WHERE email = 'tu-email@ejemplo.com';
  ```
- O insertar directamente uno con la contraseña ya cifrada en BCrypt.

Tras esto, inicia sesión en el panel con ese email/contraseña.
