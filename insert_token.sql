IF NOT EXISTS (SELECT 1 FROM SystemSettings WHERE [Key] = 'MercadoPago_AccessToken')
BEGIN
    INSERT INTO SystemSettings ([Key], [Value], [UpdatedAt])
    VALUES ('MercadoPago_AccessToken', 'APP_USR-7003455185284553-061322-352febc2248605b212e986cd37d093a9-3470892050', GETUTCDATE());
END
ELSE
BEGIN
    UPDATE SystemSettings
    SET [Value] = 'APP_USR-7003455185284553-061322-352febc2248605b212e986cd37d093a9-3470892050', [UpdatedAt] = GETUTCDATE()
    WHERE [Key] = 'MercadoPago_AccessToken';
END
