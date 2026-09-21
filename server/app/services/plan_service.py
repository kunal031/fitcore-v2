from typing import List
from beanie import PydanticObjectId

from app.core.exceptions import ConflictException, NotFoundException
from app.models.plan import PlanDocument
from app.schemas.plan import PlanCreate, PlanRead, PlanUpdate
from app.utils.date_utils import get_utc_now


class PlanService:
    @staticmethod
    def to_plan_read(plan: PlanDocument) -> PlanRead:
        return PlanRead(
            id=str(plan.id),
            plan_name=plan.plan_name,
            description=plan.description,
            category=plan.category,
            price_paise=plan.price_paise,
            calendar_days=plan.calendar_days,
            allocated_days=plan.allocated_days,
            features=plan.features,
            is_active=plan.is_active,
            created_at=plan.created_at,
        )

    async def list_active(self) -> List[PlanRead]:
        plans = await PlanDocument.find(
            PlanDocument.is_active == True
        ).sort("price_paise").to_list()
        return [self.to_plan_read(p) for p in plans]

    async def list_all(self) -> List[PlanRead]:
        plans = await PlanDocument.find_all().sort("-created_at").to_list()
        return [self.to_plan_read(p) for p in plans]

    async def get_by_id(self, plan_id: str) -> PlanRead:
        plan = await PlanDocument.get(PydanticObjectId(plan_id))
        if not plan:
            raise NotFoundException("Plan not found", "PLAN_NOT_FOUND")
        return self.to_plan_read(plan)

    async def create(self, payload: PlanCreate) -> PlanRead:
        existing = await PlanDocument.find_one(
            PlanDocument.plan_name == payload.plan_name,
            PlanDocument.is_active == True,
        )
        if existing:
            raise ConflictException(
                message=f"A plan named '{payload.plan_name}' already exists.",
                error_code="PLAN_NAME_EXISTS",
            )

        new_plan = PlanDocument(
            plan_name=payload.plan_name,
            description=payload.description,
            category=payload.category,
            price_paise=payload.price_paise,
            calendar_days=payload.calendar_days,
            allocated_days=payload.allocated_days,
            features=payload.features,
            is_active=True,
        )
        await new_plan.insert()
        return self.to_plan_read(new_plan)

    async def update(self, plan_id: str, payload: PlanUpdate) -> PlanRead:
        plan = await PlanDocument.get(PydanticObjectId(plan_id))
        if not plan:
            raise NotFoundException("Plan not found", "PLAN_NOT_FOUND")

        if payload.plan_name is not None:
            plan.plan_name = payload.plan_name
        if payload.description is not None:
            plan.description = payload.description
        if payload.category is not None:
            plan.category = payload.category
        if payload.price_paise is not None:
            plan.price_paise = payload.price_paise
        if payload.calendar_days is not None:
            plan.calendar_days = payload.calendar_days
        if payload.allocated_days is not None:
            plan.allocated_days = payload.allocated_days
        if payload.features is not None:
            plan.features = payload.features
        if payload.is_active is not None:
            plan.is_active = payload.is_active

        plan.updated_at = get_utc_now()
        await plan.save()
        return self.to_plan_read(plan)

    async def set_active(self, plan_id: str, is_active: bool) -> PlanRead:
        plan = await PlanDocument.get(PydanticObjectId(plan_id))
        if not plan:
            raise NotFoundException("Plan not found", "PLAN_NOT_FOUND")
        plan.is_active = is_active
        plan.updated_at = get_utc_now()
        await plan.save()
        return self.to_plan_read(plan)


plan_service = PlanService()
