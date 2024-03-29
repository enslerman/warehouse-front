import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Product, ShipmentsService } from '../shipments.service';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { User } from '../../users/users.service';
import { InformerService } from '../../../service/informer.service';

@Component({
  selector: 'app-create-shipment',
  templateUrl: './create-shipment.component.html',
  styleUrls: ['./create-shipment.component.scss']
})
export class CreateShipmentComponent implements OnInit, OnDestroy {
  constructor(
    private http: ShipmentsService,
    private formBuilder: FormBuilder,
    private router: Router,
    private informer: InformerService,
  ) {
    this.fg = new FormGroup({
      productsSelected: new FormControl(null),
      suppSelected: new FormControl(null, Validators.required)
    });
    this.fgs = new FormGroup({});
  }

  prods: Product[] = [];
  selectedProds: Product[] = [];
  selectedProdsForShip: Product[] = [];
  private destroy$ = new Subject<void>();
  fg: FormGroup;
  fgs: FormGroup;
  dynamicForm: FormGroup;
  supps: User[];
  emp: User;
  spin = false;

  ngOnInit(): void {
    this.spin = true;
    this.http.getSuppliers().pipe(
      takeUntil(this.destroy$)
    ).subscribe(v => {
      if (v.status === 200) {
        this.supps = v.body;
      }
    }, error => {
      this.informer.error(error);
    });
    this.http.getProducts().pipe(
      finalize(() => {
        this.spin = false;
      }),
      takeUntil(this.destroy$)
    ).subscribe(res => {
      if (res.status === 200) {
        this.prods = res.body;
      }
    }, error => {
      this.informer.error(error);
    });
    this.fg.controls.productsSelected.valueChanges.subscribe((v: Product[]) => {
      this.selectedProds = v;
      const fc = new FormControl('', Validators.required);
      v.forEach(value => {
        this.fgs.addControl(value.barcode, fc);
      });
    });
    this.fgs.valueChanges.subscribe(value => {
      const prods: Product[] = [];
      let prod: Product;
      const keys = Object.keys(value);
      keys.forEach(key => {
        if (value[key] !== '') {
          prod = this.getItemByBarcode(key, value[key]);
          prods.push(prod);
        }
      });
      this.selectedProdsForShip = prods;
    });
    this.dynamicForm = this.formBuilder.group({
      numberOfTickets: [''],
      tickets: new FormArray([])
    });
    this.dynamicForm.controls.numberOfTickets.valueChanges.subscribe(e => {
      const numberOfTickets = e;
      if (this.t.length < numberOfTickets) {
        for (let i = this.t.length; i < numberOfTickets; i++) {
          this.t.push(this.formBuilder.group({
            name: ['', Validators.required],
            description: ['', [Validators.required]],
            amount: ['', [Validators.required]],
            price: ['', [Validators.required]],
            barcode: ['', [Validators.required, Validators.pattern('^[0-9]*$')]]
          }));
        }
      } else {
        for (let i = this.t.length; i >= numberOfTickets; i--) {
          this.t.removeAt(i);
        }
      }
    });
  }

  // tslint:disable-next-line:typedef
  get f() {
    return this.dynamicForm.controls;
  }

  // tslint:disable-next-line:typedef
  get t() {
    return this.f.tickets as FormArray;
  }

  onSubmit(): void {
    this.spin = true;
    if (this.dynamicForm.invalid) {
      return;
    }
    const prods: Product[] = this.selectedProdsForShip.concat(this.dynamicForm.value?.tickets);
    const suppID: User = this.fg.controls.suppSelected.value;
    this.emp = JSON.parse(localStorage.getItem('user'));
    // @ts-ignore
    this.http.makeShipment(suppID.id, this.emp.user_id, prods).pipe(
      finalize(() => {
        this.spin = false;
      }),
    ).subscribe(value => {
      if (value.status === 204) {
        this.informer.success('Поставка создана! Пожалуйста отгрузите прибывшие товары на склад.');
        this.router.navigate(['/shipments']);
      }
    }, error => {
      this.informer.error(error);
    });
  }

  onClear(): void {
    this.dynamicForm.reset();
    this.fgs.reset();
  }

  getItemByBarcode(barcode: string, amount: number): Product {
    let prod: Product;
    this.selectedProds.forEach(value => {
      if (value.barcode === barcode) {
        prod = value;
        prod.amount = amount;
      }
      delete value.id;
    });
    return prod;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
