
-- Allow vm_stock users to manage products (INSERT, UPDATE, DELETE)
CREATE POLICY "VM Stock can manage products"
ON public.products
FOR ALL
TO authenticated
USING (has_vm_stock_role(auth.uid()))
WITH CHECK (has_vm_stock_role(auth.uid()));

-- Allow vm_stock users to manage product variations
CREATE POLICY "VM Stock can manage product variations"
ON public.product_variations
FOR ALL
TO authenticated
USING (has_vm_stock_role(auth.uid()))
WITH CHECK (has_vm_stock_role(auth.uid()));

-- Allow vm_stock users to manage product attributes
CREATE POLICY "VM Stock can manage product attributes"
ON public.product_attributes
FOR ALL
TO authenticated
USING (has_vm_stock_role(auth.uid()))
WITH CHECK (has_vm_stock_role(auth.uid()));

-- Allow vm_stock users to manage product attribute values
CREATE POLICY "VM Stock can manage product attribute values"
ON public.product_attribute_values
FOR ALL
TO authenticated
USING (has_vm_stock_role(auth.uid()))
WITH CHECK (has_vm_stock_role(auth.uid()));

-- Allow vm_stock users to manage product variation values
CREATE POLICY "VM Stock can manage product variation values"
ON public.product_variation_values
FOR ALL
TO authenticated
USING (has_vm_stock_role(auth.uid()))
WITH CHECK (has_vm_stock_role(auth.uid()));
