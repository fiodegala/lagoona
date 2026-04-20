UPDATE user_menu_permissions
SET allowed_menus = array_append(allowed_menus, 'calendar')
WHERE NOT ('calendar' = ANY(COALESCE(allowed_menus, ARRAY[]::text[])));