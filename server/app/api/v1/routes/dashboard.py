from fastapi import APIRouter, Depends

from app.middleware.auth import require_owner, require_trainer_or_owner
from app.models.user import UserDocument
from app.schemas.common import APIResponse
from app.schemas.dashboard import (
    OwnerDashboardResponse,
    TrainerDashboardResponse,
)
from app.services.dashboard_service import dashboard_service

router = APIRouter()


@router.get("/owner", response_model=APIResponse[OwnerDashboardResponse])
async def get_owner_dashboard(current_user: UserDocument = Depends(require_owner)):
    data = await dashboard_service.get_owner_dashboard()
    return APIResponse(data=data)


@router.get("/trainer", response_model=APIResponse[TrainerDashboardResponse])
async def get_trainer_dashboard(
    current_user: UserDocument = Depends(require_trainer_or_owner),
):
    data = await dashboard_service.get_trainer_dashboard()
    return APIResponse(data=data)
