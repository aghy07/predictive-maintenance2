"""Create initial users, machines, and predictions schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-10-08
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = set(sa.inspect(bind).get_table_names())
    application_tables = {"users", "machines", "predictions"}
    if existing_tables & application_tables:
        if not application_tables.issubset(existing_tables):
            raise RuntimeError(
                "Cannot adopt a partial legacy schema; restore or repair the database before migrating"
            )
        _upgrade_legacy_schema(bind)
        return

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), server_default=sa.text("'operator'"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "machines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("machine_code", sa.String(length=50), nullable=False),
        sa.Column("machine_name", sa.String(length=150), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=False),
        sa.Column("temperature_c", sa.Float(), server_default=sa.text("0"), nullable=False),
        sa.Column("vibration_mm_s", sa.Float(), server_default=sa.text("0"), nullable=False),
        sa.Column("status", sa.String(length=30), server_default=sa.text("'healthy'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_machines_machine_code", "machines", ["machine_code"], unique=True)
    op.create_index("ix_machines_archived_at", "machines", ["archived_at"], unique=False)
    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.Column("input_data", sa.JSON(), nullable=False),
        sa.Column("prediction", sa.String(length=50), nullable=False),
        sa.Column("probability", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(length=50), nullable=False),
        sa.Column("recommended_action", sa.String(length=255), nullable=False),
        sa.Column("model_version", sa.String(length=50), server_default=sa.text("'v1.0'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["machine_id"],
            ["machines.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_predictions_machine_id_id", "predictions", ["machine_id", "id"], unique=False)


def _upgrade_legacy_schema(bind: sa.Connection) -> None:
    for statement in (
        "UPDATE machines SET temperature_c = 0 WHERE temperature_c IS NULL",
        "UPDATE machines SET vibration_mm_s = 0 WHERE vibration_mm_s IS NULL",
        "UPDATE machines SET status = 'healthy' WHERE status IS NULL",
        "UPDATE machines SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL",
        "UPDATE users SET role = 'operator' WHERE role IS NULL",
        "UPDATE users SET is_active = 1 WHERE is_active IS NULL",
        "UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL",
        "UPDATE predictions SET model_version = 'v1.0' WHERE model_version IS NULL",
        "UPDATE predictions SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL",
    ):
        bind.execute(sa.text(statement))

    with op.batch_alter_table("machines", recreate="always") as batch:
        batch.alter_column(
            "temperature_c",
            existing_type=sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
        )
        batch.alter_column(
            "vibration_mm_s",
            existing_type=sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
        )
        batch.alter_column(
            "status",
            existing_type=sa.String(length=30),
            nullable=False,
            server_default=sa.text("'healthy'"),
        )
        batch.alter_column(
            "created_at",
            existing_type=sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        )
        batch.add_column(sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table("users", recreate="always") as batch:
        batch.alter_column(
            "role",
            existing_type=sa.String(length=50),
            nullable=False,
            server_default=sa.text("'operator'"),
        )
        batch.alter_column(
            "is_active",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        )
        batch.alter_column(
            "created_at",
            existing_type=sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        )

    with op.batch_alter_table("predictions", recreate="always") as batch:
        batch.alter_column(
            "model_version",
            existing_type=sa.String(length=50),
            nullable=False,
            server_default=sa.text("'v1.0'"),
        )
        batch.alter_column(
            "created_at",
            existing_type=sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        )

    indexes = {
        table: {index["name"] for index in sa.inspect(bind).get_indexes(table)}
        for table in ("users", "machines", "predictions")
    }
    for table, obsolete_indexes in {
        "users": {"ix_users_id"},
        "machines": {"ix_machines_id"},
        "predictions": {"ix_predictions_id"},
    }.items():
        for index_name in obsolete_indexes & indexes[table]:
            op.drop_index(index_name, table_name=table)
    op.create_index("ix_machines_archived_at", "machines", ["archived_at"], unique=False)
    op.create_index("ix_predictions_machine_id_id", "predictions", ["machine_id", "id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_predictions_machine_id_id", table_name="predictions")
    op.drop_table("predictions")
    op.drop_index("ix_machines_archived_at", table_name="machines")
    op.drop_table("machines")
    op.drop_table("users")
