BEGIN TRANSACTION;
ALTER TABLE [Transactions] ADD [PaymentMethodId] int NULL;

CREATE TABLE [PaymentMethods] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(50) NOT NULL,
    [IsActive] bit NOT NULL,
    [IconName] nvarchar(max) NULL,
    [HexColor] nvarchar(max) NULL,
    CONSTRAINT [PK_PaymentMethods] PRIMARY KEY ([Id])
);

CREATE INDEX [IX_Transactions_PaymentMethodId] ON [Transactions] ([PaymentMethodId]);

ALTER TABLE [Transactions] ADD CONSTRAINT [FK_Transactions_PaymentMethods_PaymentMethodId] FOREIGN KEY ([PaymentMethodId]) REFERENCES [PaymentMethods] ([Id]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260403095329_AddPaymentMethods', N'9.0.2');

COMMIT;
GO

