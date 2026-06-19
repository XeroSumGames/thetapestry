SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'notify_new_pin';
