resource "aws_servicecatalogappregistry_application" "this" {
  name        = var.app_name
  description = "SC Hauling Planner PWA"
}
