from slowapi import Limiter
from slowapi.util import get_remote_address

# Limiter compartido por toda la app. En producción, usar Redis como storage:
# Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379")
limiter = Limiter(key_func=get_remote_address)
